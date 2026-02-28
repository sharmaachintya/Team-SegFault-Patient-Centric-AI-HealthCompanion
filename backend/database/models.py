"""Data models for AI Health Companion."""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Health Profile Models ---

class Medication(BaseModel):
    name: str
    dosage: str = ""
    frequency: str = ""
    start_date: str = ""
    notes: str = ""


class HealthProfile(BaseModel):
    patient_id: str = ""
    name: str = ""
    age: Optional[int] = None
    sex: Optional[str] = None
    medications: list[Medication] = []
    conditions: list[str] = []
    allergies: list[str] = []
    lifestyle_notes: str = ""
    created_at: str = ""
    updated_at: str = ""


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    medications: Optional[list[Medication]] = None
    conditions: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    lifestyle_notes: Optional[str] = None


# --- Health Timeline Models ---

class TimelineEvent(BaseModel):
    event_id: str = ""
    patient_id: str = ""
    event_type: str  # medication_started, medication_stopped, symptom_reported, symptom_resolved, condition_noted, lifestyle_change, insight, image_uploaded
    title: str
    description: str = ""
    severity: Optional[str] = None  # low, medium, high, urgent
    timestamp: str = ""
    source: str = "user"  # user or system
    metadata: dict = {}


# --- Conversation Models ---

class ChatMessage(BaseModel):
    message_id: str = ""
    patient_id: str = ""
    role: str  # user or assistant
    content: str
    timestamp: str = ""
    has_image: bool = False
    image_key: str = ""
    urgency_level: Optional[str] = None  # reassurance, monitor, see_doctor, urgent


class ChatRequest(BaseModel):
    patient_id: str
    message: str
    conversation_history: list[dict] = []


class ChatResponse(BaseModel):
    response: str
    urgency_level: Optional[str] = None
    new_timeline_events: list[TimelineEvent] = []
    patterns_discovered: list[str] = []
