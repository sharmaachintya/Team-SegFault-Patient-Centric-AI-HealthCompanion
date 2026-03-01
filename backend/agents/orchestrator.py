"""
AI Health Companion Orchestrator - Agentic AI with Tool Calling.

This is the core of the system. A single Claude model acts as the Supervisor Agent,
and each "specialized agent" is implemented as a tool that Claude can invoke.
Claude autonomously decides which tools to call based on conversation context.
"""
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from database.store import StorageBackend
from services.bedrock import AIClient

logger = logging.getLogger(__name__)

# IST timezone (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

# Maximum tool-calling iterations to prevent infinite loops
MAX_TOOL_ITERATIONS = 6

SYSTEM_PROMPT_TEMPLATE = """You are **MedAlly**, a patient-centric, non-diagnostic AI health companion. You help patients understand their health between doctor visits by providing personalized, context-aware guidance.

## YOUR IDENTITY
- Your name is **MedAlly** — always refer to yourself as MedAlly
- You are a supportive health companion, NOT a doctor or medical professional
- You maintain a warm, empathetic, and conversational tone
- You remember the patient's health context and use it in every response
- You are powered by multiple specialized capabilities (tools) that you coordinate intelligently

## INDIA LOCALIZATION (CRITICAL — This app is built for Indian patients)
- **Emergency numbers**: Use **112** (India unified emergency), **108** (ambulance), **102** (pregnancy/infant emergencies). NEVER say "call 911" — that is the US number.
- **Healthcare references**: Refer to visiting a local clinic, PHC (Primary Health Centre), district hospital, or government hospital. For specialists, mention consulting at hospitals like AIIMS, Safdarjung, or their local government/private hospital.
- **Pharmacy**: Reference Jan Aushadhi Kendras (affordable generics), Apollo Pharmacy, MedPlus, or local chemist shops.
- **Insurance**: Be aware of Ayushman Bharat (PM-JAY), CGHS, ESIC, and state health insurance schemes.
- **Cultural context**: Be aware of Indian dietary habits (vegetarian/non-veg, dal-roti-rice-sabzi, chai, ghee, etc.), joint family dynamics, and Indian healthcare-seeking behavior.
- **Affordability**: Be mindful that cost is a major factor — mention generic medicines and affordable alternatives when relevant.
- **Language**: Use simple English but be comfortable with common Hindi/Indian medical terms if the patient uses them (BP, sugar, tablet, doctor sahab, etc.).

## CORE SAFETY PRINCIPLES (NEVER VIOLATE)
1. **NEVER prescribe** treatments, medications, or dosage changes
2. **NEVER replace** medical professionals - always encourage professional consultation
3. **NEVER dismiss** potentially serious symptoms - err on the side of caution
4. For general symptoms: describe features rather than label conditions
5. **Skin image analysis is DIFFERENT**: For skin images, you ARE EXPECTED to name likely conditions with confidence levels. This is the core value of our skin analysis feature. Always include a disclaimer recommending professional confirmation.
6. When uncertain, recommend seeking medical advice

## YOUR CAPABILITIES (USE TOOLS PROACTIVELY)
You have access to specialized tools that act as your "agent team":

1. **Health Profile Tool** (get_health_profile): Retrieve the patient's medications, conditions, allergies, and personal info. ALWAYS call this at the start if you need context about the patient.

2. **Health Timeline Search** (search_health_timeline): Search the patient's health event history for patterns, past symptoms, medication changes. Use this to provide context-aware responses.

3. **Health Event Logger** (log_health_event): Log NEW health events to the timeline. IMPORTANT: Before logging, mentally check if a similar event was already logged recently. Do NOT re-log the same symptom/issue — only log if there is genuinely new information (e.g., symptom worsened, new trigger discovered, new symptom appeared).

4. **Pattern Analyzer** (analyze_health_patterns): Analyze the patient's health timeline to discover correlations, trends, and patterns. Use when asked about patterns or when you notice potential connections.

5. **Profile Updater** (update_health_profile): Update the patient's health profile with new information. Use this AUTOMATICALLY whenever you learn the patient's name, age, sex, medications, chronic conditions, or allergies from conversation.

## CRITICAL: HEALTH PROFILE MANAGEMENT
- **If the patient's profile is empty/new**: Your FIRST priority is to gather basic health information. Warmly ask for their name, age, any current medications, known conditions, and allergies. Do this conversationally, not like a form.
- **Auto-extract profile data**: Whenever a patient mentions personal details (name, age), medications they take, chronic conditions (diabetes, hypertension, asthma, etc.), or allergies — IMMEDIATELY call `update_health_profile` to save it. Don't wait to be asked.
- **Distinguish chronic vs acute**: Only add CHRONIC/LONG-TERM conditions to the profile (diabetes, hypertension, asthma, thyroid, etc.). Short-term issues (cold, headache, cough) go to the timeline via `log_health_event`, not the profile.
- **Medications**: Add any medication the patient says they are currently taking regularly. Don't add one-time medications.

## HOW TO RESPOND

### For Symptom Questions (Side-Effect Reality Checker):
- First, retrieve the patient's health profile and recent timeline
- Cross-reference the symptom with their medications, conditions, and timing
- Provide one of these response levels with the appropriate emoji:
  - ✅ **REASSURANCE**: Common, expected, likely benign - explain why
  - ⚠️ **MONITOR**: Worth watching - provide specific monitoring criteria
  - 🏥 **SEE DOCTOR**: Schedule an appointment - explain why it warrants attention
  - 🚨 **URGENT**: Seek immediate medical attention - be clear and direct

### For Medical Information Questions (Noise Filter):
- When a patient shares scary health info, statistics, or articles:
  - Retrieve their profile to understand their specific situation
  - Contextualize the information for THEIR personal circumstances
  - Explain relative vs. absolute risk in plain language
  - Distinguish between general population data and individual applicability
  - Reduce unnecessary anxiety while maintaining appropriate vigilance
  - Help them formulate questions for their doctor

### For Pattern Discovery:
- Use the timeline search and pattern analyzer tools
- Look for temporal correlations (symptom timing vs. medication changes)
- Identify recurring patterns (seasonal, cyclical, situational)
- Surface insights proactively: "I noticed that..." 
- Always note that correlation doesn't mean causation

### For Skin Image Analysis:
- When an image is provided, you MUST analyze it thoroughly and provide your best assessment
- Describe: color, texture, borders, size, symmetry, surface features
- **YOU ARE REQUIRED to name the most likely skin condition(s)** when the visual evidence is clear. This is a core feature of our product. Examples: acne, eczema, psoriasis, ringworm, contact dermatitis, fungal infection, hives, rosacea, seborrheic dermatitis, impetigo, warts, sunburn, insect bites, etc.
- Format your identification as: "**Likely condition:** [name] (Confidence: High/Medium/Low)"
- If multiple conditions are possible, list the top 2-3 possibilities with confidence levels
- Only withhold condition names if the image is too blurry/unclear to analyze
- After naming the condition, provide: common causes, typical treatments to discuss with a doctor, monitoring guidance, and when to seek professional care
- Always add a one-line disclaimer: *"This is an AI-assisted visual assessment, not a medical diagnosis. Please confirm with a healthcare professional."*
- Track changes if previous images exist

### For General Health Questions:
- Provide helpful, evidence-based health information
- Always personalize based on their health profile
- Encourage professional medical consultation for specific medical decisions

## RESPONSE FORMAT
- Use markdown formatting for readability
- Be conversational but informative
- Keep responses focused and not overly long
- Include a brief relevant disclaimer when providing health guidance
- When logging health events via tools, do it silently (don't tell the user you're logging unless relevant)

## CURRENT PATIENT CONTEXT
{patient_context}

## CURRENT DATE
{current_date}

Remember: You are an intelligent health companion that coordinates multiple capabilities to provide the best possible guidance. Use your tools proactively and intelligently."""


TOOL_DEFINITIONS = [
    {
        "toolSpec": {
            "name": "get_health_profile",
            "description": "Retrieve the patient's complete health profile including current medications (with dosages and start dates), diagnosed conditions, known allergies, and personal information. Use this tool whenever you need to understand the patient's health context to provide personalized guidance.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "search_health_timeline",
            "description": "Search the patient's health timeline for relevant events including past symptoms, medication changes, health insights, and patterns. Use this to find historical context that helps you provide better guidance. Returns events sorted by most recent first.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "event_type": {
                            "type": "string",
                            "enum": ["all", "medication_started", "medication_stopped", "symptom_reported", "symptom_resolved", "condition_noted", "lifestyle_change", "insight", "image_uploaded"],
                            "description": "Filter by event type. Use 'all' to get all events."
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of events to return. Default is 20."
                        }
                    },
                    "required": []
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "log_health_event",
            "description": "Log a genuinely NEW health event to the patient's timeline. IMPORTANT: Do NOT re-log symptoms/events that are already in the timeline. Only log if this is new information, a new symptom, a significant change, or an update to an existing condition.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "event_type": {
                            "type": "string",
                            "enum": ["medication_started", "medication_stopped", "symptom_reported", "symptom_resolved", "condition_noted", "lifestyle_change", "insight"],
                            "description": "The type of health event"
                        },
                        "display_summary": {
                            "type": "string",
                            "description": "SHORT one-line summary for UI display (max 60 chars). E.g., 'Headaches — 7 days, posture-related', 'Started Metformin 500mg', 'Dry cough resolved'"
                        },
                        "title": {
                            "type": "string",
                            "description": "Clear title for the event (e.g., 'Severe headaches for 7 days with computer work')"
                        },
                        "description": {
                            "type": "string",
                            "description": "Detailed description with full context: timing, triggers, severity, related factors, what was discussed. This is used for AI reasoning and pattern analysis."
                        },
                        "severity": {
                            "type": "string",
                            "enum": ["low", "medium", "high", "urgent"],
                            "description": "Severity level of the event. Use 'low' for minor/expected, 'medium' for notable, 'high' for concerning, 'urgent' for emergency."
                        }
                    },
                    "required": ["event_type", "display_summary", "title", "description"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "analyze_health_patterns",
            "description": "Analyze the patient's FULL health history to discover patterns, correlations, and trends. This tool retrieves both structured timeline events AND the complete conversation history (which contains detailed AI analyses, patient descriptions, and rich context). Use this for deep pattern analysis across the patient's entire health journey.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "focus_area": {
                            "type": "string",
                            "description": "What aspect to focus the pattern analysis on (e.g., 'headache frequency', 'medication side effects', 'symptom triggers', 'overall health trends')"
                        }
                    },
                    "required": ["focus_area"]
                }
            }
        }
    },
    {
        "toolSpec": {
            "name": "update_health_profile",
            "description": "Update the patient's health profile with information extracted from conversation. Call this IMMEDIATELY whenever you learn new profile-worthy information: patient's name, age, sex, medications (regular/ongoing only), chronic conditions (diabetes, hypertension, asthma, thyroid, etc.), or allergies. You can update one or multiple fields at once. Only provide the fields you want to update — others will remain unchanged.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Patient's name"
                        },
                        "age": {
                            "type": "integer",
                            "description": "Patient's age"
                        },
                        "sex": {
                            "type": "string",
                            "enum": ["Male", "Female", "Other"],
                            "description": "Patient's sex"
                        },
                        "add_medication": {
                            "type": "object",
                            "description": "A medication to ADD to the profile",
                            "properties": {
                                "name": {"type": "string", "description": "Medication name"},
                                "dosage": {"type": "string", "description": "Dosage (e.g., '500mg')"},
                                "frequency": {"type": "string", "description": "Frequency (e.g., 'twice daily')"}
                            },
                            "required": ["name"]
                        },
                        "add_condition": {
                            "type": "string",
                            "description": "A chronic condition to ADD (e.g., 'Type 2 Diabetes', 'Hypertension')"
                        },
                        "add_allergy": {
                            "type": "string",
                            "description": "An allergy to ADD (e.g., 'Penicillin', 'Peanuts')"
                        },
                        "lifestyle_notes": {
                            "type": "string",
                            "description": "Lifestyle information (diet, exercise, sleep, stress)"
                        }
                    },
                    "required": []
                }
            }
        }
    }
]


class HealthCompanionOrchestrator:
    """Main orchestrator that coordinates Claude with tools to provide health guidance."""

    def __init__(self, bedrock: AIClient, storage: StorageBackend):
        self.bedrock = bedrock
        self.storage = storage

    def _build_patient_context(self, profile: dict) -> str:
        """Build a readable patient context string from the profile."""
        if not profile:
            return "No health profile set up yet. The patient is new - encourage them to set up their health profile."

        parts = []
        if profile.get("name"):
            parts.append(f"**Name:** {profile['name']}")
        if profile.get("age"):
            parts.append(f"**Age:** {profile['age']}")
        if profile.get("sex"):
            parts.append(f"**Sex:** {profile['sex']}")

        meds = profile.get("medications", [])
        if meds:
            med_lines = []
            for m in meds:
                if isinstance(m, dict):
                    line = m.get("name", "Unknown")
                    if m.get("dosage"):
                        line += f" ({m['dosage']})"
                    if m.get("frequency"):
                        line += f" - {m['frequency']}"
                    if m.get("start_date"):
                        line += f" [started: {m['start_date']}]"
                    med_lines.append(f"  - {line}")
                else:
                    med_lines.append(f"  - {m}")
            parts.append("**Current Medications:**\n" + "\n".join(med_lines))

        conditions = profile.get("conditions", [])
        if conditions:
            parts.append("**Conditions:** " + ", ".join(conditions))

        allergies = profile.get("allergies", [])
        if allergies:
            parts.append("**Allergies:** " + ", ".join(allergies))

        if profile.get("lifestyle_notes"):
            parts.append(f"**Lifestyle Notes:** {profile['lifestyle_notes']}")

        return "\n".join(parts) if parts else "Profile exists but is mostly empty."

    def _build_system_prompt(self, profile: dict) -> str:
        """Build the complete system prompt with patient context."""
        context = self._build_patient_context(profile)
        return SYSTEM_PROMPT_TEMPLATE.format(
            patient_context=context,
            current_date=datetime.now(IST).strftime("%Y-%m-%d")
        )

    async def _execute_tool(self, tool_name: str, tool_input: dict, patient_id: str) -> str:
        """Execute a tool call and return the result as a string."""
        try:
            if tool_name == "get_health_profile":
                profile = await self.storage.get_profile(patient_id)
                if profile:
                    return json.dumps(profile, indent=2, default=str)
                return "No health profile found. The patient should set up their profile with medications, conditions, and allergies."

            elif tool_name == "search_health_timeline":
                event_type = tool_input.get("event_type", "all")
                limit = tool_input.get("limit", 20)
                events = await self.storage.get_timeline(patient_id, limit=limit)
                if event_type != "all":
                    events = [e for e in events if e.get("event_type") == event_type]
                if events:
                    return json.dumps(events, indent=2, default=str)
                return "No health timeline events found. The timeline will build up as the patient shares health information."

            elif tool_name == "log_health_event":
                event = {
                    "event_type": tool_input.get("event_type", "insight"),
                    "display_summary": tool_input.get("display_summary", tool_input.get("title", "")[:60]),
                    "title": tool_input.get("title", ""),
                    "description": tool_input.get("description", ""),
                    "severity": tool_input.get("severity", "low"),
                    "source": "system",
                }
                saved = await self.storage.add_timeline_event(patient_id, event)
                return json.dumps({"status": "logged", "event": saved}, default=str)

            elif tool_name == "analyze_health_patterns":
                focus = tool_input.get("focus_area", "general")

                # 1. Structured timeline events (dates, types, severity)
                events = await self.storage.get_timeline(patient_id, limit=50)

                # 2. Full conversation history (rich context with AI analyses)
                conversations = await self.storage.get_conversations(patient_id, limit=50)

                if not events and not conversations:
                    return "Not enough health data to analyze patterns. More data will accumulate as the patient uses the system."

                summary = f"Pattern analysis focused on: '{focus}'\n\n"

                if events:
                    summary += f"=== HEALTH TIMELINE ({len(events)} structured events) ===\n"
                    for e in events:
                        summary += f"- [{e.get('timestamp', 'unknown')}] {e.get('event_type', '')}: {e.get('title', '')} - {e.get('description', '')} (severity: {e.get('severity', 'N/A')})\n"

                if conversations:
                    summary += f"\n=== CONVERSATION HISTORY ({len(conversations)} messages — contains detailed AI analyses and patient descriptions) ===\n"
                    for msg in conversations:
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        ts = msg.get('timestamp', '')
                        # Truncate long messages to stay within token limits
                        if len(content) > 600:
                            content = content[:600] + "... [truncated]"
                        summary += f"[{ts}] {role.upper()}: {content}\n\n"

                return summary

            elif tool_name == "update_health_profile":
                # Get existing profile
                profile = await self.storage.get_profile(patient_id) or {}
                updates = []

                # Update basic fields
                if tool_input.get("name"):
                    profile["name"] = tool_input["name"]
                    updates.append(f"name: {tool_input['name']}")
                if tool_input.get("age"):
                    profile["age"] = tool_input["age"]
                    updates.append(f"age: {tool_input['age']}")
                if tool_input.get("sex"):
                    profile["sex"] = tool_input["sex"]
                    updates.append(f"sex: {tool_input['sex']}")
                if tool_input.get("lifestyle_notes"):
                    profile["lifestyle_notes"] = tool_input["lifestyle_notes"]
                    updates.append("lifestyle notes")

                # Add medication (avoid duplicates)
                if tool_input.get("add_medication"):
                    med = tool_input["add_medication"]
                    meds = profile.get("medications", [])
                    # Check if medication already exists
                    existing_names = [m.get("name", "").lower() if isinstance(m, dict) else m.lower() for m in meds]
                    if med.get("name", "").lower() not in existing_names:
                        meds.append({
                            "name": med.get("name", ""),
                            "dosage": med.get("dosage", ""),
                            "frequency": med.get("frequency", ""),
                            "start_date": datetime.now(IST).strftime("%Y-%m-%d"),
                            "notes": "",
                        })
                        profile["medications"] = meds
                        updates.append(f"medication: {med.get('name')}")

                # Add condition (avoid duplicates)
                if tool_input.get("add_condition"):
                    condition = tool_input["add_condition"]
                    conditions = profile.get("conditions", [])
                    if condition.lower() not in [c.lower() for c in conditions]:
                        conditions.append(condition)
                        profile["conditions"] = conditions
                        updates.append(f"condition: {condition}")

                # Add allergy (avoid duplicates)
                if tool_input.get("add_allergy"):
                    allergy = tool_input["add_allergy"]
                    allergies = profile.get("allergies", [])
                    if allergy.lower() not in [a.lower() for a in allergies]:
                        allergies.append(allergy)
                        profile["allergies"] = allergies
                        updates.append(f"allergy: {allergy}")

                if updates:
                    await self.storage.save_profile(patient_id, profile)
                    return json.dumps({"status": "updated", "fields_updated": updates, "profile": profile}, default=str)
                return json.dumps({"status": "no_changes", "message": "No new information to update"})

            else:
                return f"Unknown tool: {tool_name}"

        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return f"Error executing tool {tool_name}: {str(e)}"

    async def process_message(
        self,
        patient_id: str,
        user_message: str,
        image_bytes: bytes = None,
        image_media_type: str = "image/jpeg",
        conversation_history: list[dict] = None,
    ) -> dict:
        """Process a user message through the agentic orchestration pipeline.

        Returns:
            dict with 'response', 'urgency_level', 'new_timeline_events'
        """
        # 1. Get patient profile for system prompt context
        profile = await self.storage.get_profile(patient_id)
        system_prompt = self._build_system_prompt(profile)

        # 2. Build conversation messages
        messages = []

        # Add conversation history if provided
        if conversation_history:
            for msg in conversation_history[-10:]:  # Last 10 messages for context
                if msg.get("role") in ("user", "assistant") and msg.get("content"):
                    messages.append(
                        self.bedrock.create_text_message(msg["role"], msg["content"])
                    )

        # Add current user message
        if image_bytes:
            messages.append(
                self.bedrock.create_image_message("user", user_message or "Please analyze this image.", image_bytes, image_media_type)
            )
        else:
            messages.append(
                self.bedrock.create_text_message("user", user_message)
            )

        # 3. Agentic loop - let Claude call tools iteratively
        new_timeline_events = []
        iteration = 0

        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # Call Bedrock
            response = self.bedrock.converse(
                messages=messages,
                system_prompt=system_prompt,
                tools=TOOL_DEFINITIONS,
            )

            parsed = self.bedrock.extract_response(response)

            # If Claude wants to use tools
            if parsed["tool_calls"]:
                # Add Claude's response (with tool use) to messages
                messages.append({
                    "role": "assistant",
                    "content": response["output"]["message"]["content"]
                })

                # Execute each tool and build tool results
                tool_results_content = []
                for tool_call in parsed["tool_calls"]:
                    logger.info(f"Tool call: {tool_call['name']} with input: {json.dumps(tool_call['input'])}")
                    result = await self._execute_tool(
                        tool_call["name"], tool_call["input"], patient_id
                    )

                    # Track logged events
                    if tool_call["name"] == "log_health_event":
                        try:
                            result_data = json.loads(result)
                            if result_data.get("status") == "logged":
                                new_timeline_events.append(result_data["event"])
                        except json.JSONDecodeError:
                            pass

                    tool_results_content.append(
                        self.bedrock.build_tool_result_block(tool_call["id"], result)
                    )

                # Add tool results as user message
                messages.append({
                    "role": "user",
                    "content": tool_results_content
                })

            else:
                # Claude returned a final text response
                final_text = parsed["text"]

                # Detect urgency level from response
                urgency = self._detect_urgency(final_text)

                # Save conversation messages
                await self.storage.save_message(patient_id, {
                    "role": "user",
                    "content": user_message,
                    "has_image": image_bytes is not None,
                })
                await self.storage.save_message(patient_id, {
                    "role": "assistant",
                    "content": final_text,
                    "urgency_level": urgency,
                })

                return {
                    "response": final_text,
                    "urgency_level": urgency,
                    "new_timeline_events": new_timeline_events,
                }

        # Fallback if max iterations reached
        return {
            "response": "I apologize, but I'm having difficulty processing your request right now. Please try again or rephrase your question.",
            "urgency_level": None,
            "new_timeline_events": new_timeline_events,
        }

    async def process_message_stream(
        self,
        patient_id: str,
        user_message: str,
        image_bytes: bytes = None,
        image_media_type: str = "image/jpeg",
        conversation_history: list = None,
    ):
        """Process a message with streaming for the final response.

        Yields SSE-formatted strings:
          - data: {"type": "text", "text": "..."}\n\n  for text chunks
          - data: {"type": "tool_call", "name": "..."}\n\n  when calling tools
          - data: {"type": "done", "urgency_level": "...", "new_events": [...]}\n\n  when complete
        """
        # 1. Get patient profile for system prompt
        profile = await self.storage.get_profile(patient_id)
        system_prompt = self._build_system_prompt(profile)

        # 2. Build conversation messages
        messages = []
        if conversation_history:
            for msg in conversation_history[-10:]:
                role = msg.get("role")
                content = msg.get("content") or ""
                if role in ("user", "assistant") and content:
                    messages.append(
                        self.bedrock.create_text_message(role, content)
                    )

        # Ensure messages alternate user/assistant (Bedrock requirement)
        # Remove consecutive same-role messages
        if messages:
            cleaned = [messages[0]]
            for m in messages[1:]:
                if m["role"] != cleaned[-1]["role"]:
                    cleaned.append(m)
            messages = cleaned

        if image_bytes:
            messages.append(
                self.bedrock.create_image_message("user", user_message or "Please analyze this image.", image_bytes, image_media_type)
            )
        else:
            messages.append(
                self.bedrock.create_text_message("user", user_message)
            )

        # 3. Tool-calling loop (non-streaming) until we get to final response
        new_timeline_events = []
        iteration = 0

        while iteration < MAX_TOOL_ITERATIONS:
            iteration += 1

            # First try non-streaming to check for tool calls
            # Use streaming for the response to detect if it's tools or text
            collected_text = ""
            tool_calls = []
            current_tool = None

            # Stream Bedrock response through async queue to avoid blocking
            chunk_queue = asyncio.Queue()
            loop = asyncio.get_event_loop()

            def _run_bedrock_stream():
                try:
                    for c in self.bedrock.converse_stream(
                        messages=messages,
                        system_prompt=system_prompt,
                        tools=TOOL_DEFINITIONS,
                    ):
                        asyncio.run_coroutine_threadsafe(chunk_queue.put(c), loop)
                except Exception as ex:
                    asyncio.run_coroutine_threadsafe(
                        chunk_queue.put({"type": "error", "error": str(ex)}), loop
                    )
                finally:
                    asyncio.run_coroutine_threadsafe(chunk_queue.put(None), loop)

            import threading
            thread = threading.Thread(target=_run_bedrock_stream, daemon=True)
            thread.start()

            while True:
                chunk = await chunk_queue.get()
                if chunk is None:
                    break
                if chunk.get("type") == "error":
                    raise Exception(chunk["error"])

                if chunk["type"] == "text":
                    collected_text += chunk["text"]
                    yield json.dumps({"type": "text", "text": chunk["text"]}) + "\n"

                elif chunk["type"] == "tool_use_start":
                    current_tool = {"id": chunk["id"], "name": chunk["name"], "input_json": ""}
                    yield json.dumps({"type": "tool_call", "name": chunk["name"]}) + "\n"

                elif chunk["type"] == "tool_use_delta":
                    if current_tool:
                        current_tool["input_json"] += chunk.get("input_json", "")

                elif chunk["type"] == "tool_use_end":
                    if current_tool:
                        try:
                            tool_input = json.loads(chunk.get("input_json", "{}") or "{}")
                        except json.JSONDecodeError:
                            tool_input = {}
                        tool_calls.append({
                            "id": current_tool["id"],
                            "name": current_tool["name"],
                            "input": tool_input,
                        })
                        current_tool = None

                elif chunk["type"] == "done":
                    pass

            thread.join(timeout=5)

            # If there were tool calls, execute them and continue the loop
            if tool_calls:
                # Build assistant message with tool use blocks
                assistant_content = []
                if collected_text:
                    assistant_content.append({"type": "text", "text": collected_text})
                for tc in tool_calls:
                    assistant_content.append(
                        self.bedrock.build_tool_use_block(tc["id"], tc["name"], tc["input"])
                    )
                messages.append({"role": "assistant", "content": assistant_content})

                # Execute tools
                tool_results_content = []
                for tc in tool_calls:
                    logger.info(f"Stream tool call: {tc['name']}")
                    result = await self._execute_tool(tc["name"], tc["input"], patient_id)

                    if tc["name"] == "log_health_event":
                        try:
                            result_data = json.loads(result)
                            if result_data.get("status") == "logged":
                                new_timeline_events.append(result_data["event"])
                        except json.JSONDecodeError:
                            pass

                    tool_results_content.append(
                        self.bedrock.build_tool_result_block(tc["id"], result)
                    )

                messages.append({"role": "user", "content": tool_results_content})
                collected_text = ""
                # Continue loop - next iteration will stream the final response

            else:
                # No tool calls - we've streamed the final text response
                urgency = self._detect_urgency(collected_text)

                # Save conversation
                await self.storage.save_message(patient_id, {
                    "role": "user",
                    "content": user_message,
                    "has_image": image_bytes is not None,
                })
                await self.storage.save_message(patient_id, {
                    "role": "assistant",
                    "content": collected_text,
                    "urgency_level": urgency,
                })

                # Send done event
                yield json.dumps({
                    "type": "done",
                    "urgency_level": urgency,
                    "new_timeline_events": new_timeline_events,
                    "full_text": collected_text,
                }) + "\n"
                return

        # Fallback
        yield json.dumps({
            "type": "done",
            "urgency_level": None,
            "new_timeline_events": new_timeline_events,
            "full_text": "I apologize, but I had difficulty processing your request. Please try again.",
        }) + "\n"

    def _detect_urgency(self, text: str) -> str:
        """Detect urgency level from the response text."""
        text_lower = text.lower()
        if "🚨" in text or "urgent" in text_lower and ("seek immediate" in text_lower or "emergency" in text_lower or "call 112" in text_lower or "call 108" in text_lower):
            return "urgent"
        elif "🏥" in text or "see doctor" in text_lower or "see your doctor" in text_lower or "schedule an appointment" in text_lower:
            return "see_doctor"
        elif "⚠️" in text or "monitor" in text_lower and ("watch for" in text_lower or "keep an eye" in text_lower):
            return "monitor"
        elif "✅" in text or "reassur" in text_lower or "common side effect" in text_lower or "expected" in text_lower:
            return "reassurance"
        return None
