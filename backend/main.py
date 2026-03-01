"""AI Health Companion - FastAPI Backend Server."""
import os
import sys
import json
import uuid
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from config import config
from database.store import create_storage
from database.models import (
    HealthProfile, ProfileUpdate, Medication,
    TimelineEvent, ChatRequest, ChatResponse,
)
from services.bedrock import create_ai_client, BedrockClient
from services.s3 import ImageStorage
from agents.orchestrator import HealthCompanionOrchestrator

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize app
app = FastAPI(
    title="MedAlly",
    description="Patient-Centric, Non-Diagnostic AI Health Companion powered by Agentic AI",
    version="1.0.0",
)

# CORS - allow all origins for prototype
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
storage = create_storage(config)
ai_client = create_ai_client()
image_storage = ImageStorage()
orchestrator = HealthCompanionOrchestrator(ai_client, storage)


# ============================================================
# Health Profile Endpoints
# ============================================================

@app.get("/api/profile/{patient_id}")
async def get_profile(patient_id: str):
    """Get the patient's health profile."""
    profile = await storage.get_profile(patient_id)
    if profile:
        return profile
    # Return empty profile template
    return {
        "patient_id": patient_id,
        "name": "",
        "age": None,
        "sex": None,
        "medications": [],
        "conditions": [],
        "allergies": [],
        "lifestyle_notes": "",
        "created_at": "",
        "updated_at": "",
    }


@app.put("/api/profile/{patient_id}")
async def update_profile(patient_id: str, profile: ProfileUpdate):
    """Update the patient's health profile."""
    # Get existing profile
    existing = await storage.get_profile(patient_id) or {}

    # Merge updates
    update_data = profile.model_dump(exclude_none=True)

    # Convert medications to dicts
    if "medications" in update_data:
        update_data["medications"] = [
            m.model_dump() if hasattr(m, "model_dump") else m
            for m in update_data["medications"]
        ]

    merged = {**existing, **update_data}
    saved = await storage.save_profile(patient_id, merged)
    return saved


@app.post("/api/profile/create")
async def create_profile():
    """Create a new patient profile with a generated ID."""
    patient_id = str(uuid.uuid4())[:8]
    profile = {
        "patient_id": patient_id,
        "name": "",
        "age": None,
        "sex": None,
        "medications": [],
        "conditions": [],
        "allergies": [],
        "lifestyle_notes": "",
    }
    saved = await storage.save_profile(patient_id, profile)
    return saved


# ============================================================
# Chat Endpoints
# ============================================================

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Send a text message and get AI response."""
    try:
        # Get conversation history from storage
        history = await storage.get_conversations(request.patient_id, limit=10)

        result = await orchestrator.process_message(
            patient_id=request.patient_id,
            user_message=request.message,
            conversation_history=request.conversation_history or history,
        )

        return ChatResponse(
            response=result["response"],
            urgency_level=result.get("urgency_level"),
            new_timeline_events=[
                TimelineEvent(**e) if isinstance(e, dict) else e
                for e in result.get("new_timeline_events", [])
            ],
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing error: {str(e)}")


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Send a text message and get streaming AI response via SSE."""
    async def event_generator():
        try:
            history = await storage.get_conversations(request.patient_id, limit=10)
            async for chunk in orchestrator.process_message_stream(
                patient_id=request.patient_id,
                user_message=request.message,
                conversation_history=request.conversation_history or history,
            ):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            logger.error(f"Stream chat error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat/image")
async def chat_with_image(
    patient_id: str = Form(...),
    message: str = Form("Please analyze this skin image and provide guidance."),
    image: UploadFile = File(...),
):
    """Send a message with an image for visual analysis."""
    try:
        # Read image
        image_bytes = await image.read()
        content_type = image.content_type or "image/jpeg"

        # Store image
        img_meta = await image_storage.upload_image(patient_id, image_bytes, content_type)

        # Log image upload to timeline
        await storage.add_timeline_event(patient_id, {
            "event_type": "image_uploaded",
            "title": "Skin image uploaded for analysis",
            "description": f"Patient uploaded an image for analysis. Message: {message}",
            "severity": "low",
            "source": "user",
            "metadata": {"image_key": img_meta["key"], "image_id": img_meta["image_id"]},
        })

        # Get conversation history
        history = await storage.get_conversations(patient_id, limit=10)

        # Process with image
        result = await orchestrator.process_message(
            patient_id=patient_id,
            user_message=message,
            image_bytes=image_bytes,
            image_media_type=content_type,
            conversation_history=history,
        )

        return ChatResponse(
            response=result["response"],
            urgency_level=result.get("urgency_level"),
            new_timeline_events=[
                TimelineEvent(**e) if isinstance(e, dict) else e
                for e in result.get("new_timeline_events", [])
            ],
        )
    except Exception as e:
        logger.error(f"Image chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")


# ============================================================
# Timeline Endpoints
# ============================================================

@app.get("/api/timeline/{patient_id}")
async def get_timeline(patient_id: str, limit: int = 50):
    """Get the patient's health timeline events."""
    events = await storage.get_timeline(patient_id, limit=limit)
    return {"events": events}


@app.post("/api/timeline/{patient_id}/events")
async def add_timeline_event(patient_id: str, event: TimelineEvent):
    """Manually add a health event to the timeline."""
    event_dict = event.model_dump()
    saved = await storage.add_timeline_event(patient_id, event_dict)
    return saved


@app.delete("/api/timeline/{patient_id}/events/{event_id}")
async def delete_timeline_event(patient_id: str, event_id: str):
    """Delete a timeline event."""
    success = await storage.delete_timeline_event(patient_id, event_id)
    if success:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Event not found")


# ============================================================
# Conversation Endpoints
# ============================================================

@app.get("/api/conversations/{patient_id}")
async def get_conversations(patient_id: str, limit: int = 50):
    """Get conversation history."""
    messages = await storage.get_conversations(patient_id, limit=limit)
    return {"messages": messages}


@app.delete("/api/conversations/{patient_id}")
async def clear_conversations(patient_id: str):
    """Clear conversation history."""
    await storage.clear_conversations(patient_id)
    return {"status": "cleared"}


# ============================================================
# Health & Info Endpoints
# ============================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "AI Health Companion",
        "version": "1.0.0",
        "storage_mode": config.STORAGE_MODE,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================
# Serve Frontend Static Files
# ============================================================

# Check if frontend build exists
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
    )
