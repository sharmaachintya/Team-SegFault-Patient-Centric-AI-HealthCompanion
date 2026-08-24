# Building MedAlly: An Agentic AI Health Companion with Amazon Bedrock, DynamoDB, and S3

*How we built a patient-centric AI health assistant that remembers your medical history, analyzes symptoms against your medications, and provides personalized health guidance — all powered by AWS.*

---

## The Problem: Patients Are Lost Between Doctor Visits

Every day, millions of Indians turn to Google with health concerns — "Is this side effect normal?", "Should I stop my medication?", "What is this spot on my skin?" — and walk away more confused, more anxious, and more misinformed than before.

The core issues we identified:

1. **No personalization**: Search engines and generic chatbots give the same answer to everyone. They don't know your medications, your conditions, or your history.
2. **No memory**: Even advanced chatbots like ChatGPT forget everything between sessions. You have to repeat your entire medical history every time.
3. **Information anxiety**: Patients read scary health articles online and panic — but the statistics they read may not apply to their specific situation at all.
4. **Lost health patterns**: Patients can't track correlations between symptoms, medications, and lifestyle changes over time.
5. **No intelligent triage**: Patients don't know whether their symptom needs emergency care, a doctor's appointment, or just monitoring.

We wanted to build something different — an AI health companion that actually **understands you**, **remembers your journey**, and **reasons over your personal context** to provide meaningful guidance.

---

## Our Solution: MedAlly

MedAlly is a patient-centric AI health companion built on agentic AI principles. Unlike traditional chatbots that provide generic responses, MedAlly:

- **Maintains a longitudinal health profile** — your medications, conditions, allergies, and health events are stored persistently and used in every conversation
- **Uses agentic AI with tool calling** — a supervisor agent autonomously orchestrates 6 specialized tool-agents to retrieve context, log events, analyze patterns, and update profiles
- **Provides personalized health guidance** — every response is contextualized against YOUR specific health profile
- **Supports multimodal input** — text, voice, and skin image analysis
- **Streams responses in real-time** — word-by-word like modern AI assistants

**Live Demo**: [https://medally.duckdns.org](https://medally.duckdns.org)  
**GitHub**: [https://github.com/sharmaachintya/Team-SegFault-Patient-Centric-AI-HealthCompanion](https://github.com/sharmaachintya/Team-SegFault-Patient-Centric-AI-HealthCompanion)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│         React + Tailwind CSS (Text / Voice / Image)      │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API + SSE Streaming
┌──────────────────────────┴──────────────────────────────┐
│                  FastAPI Backend (EC2)                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Supervisor Agent (Orchestrator)             │  │
│  │     System Prompt + Patient Context + Tools         │  │
│  │                                                    │  │
│  │  ┌─────────────────────────────────────────────┐   │  │
│  │  │        Amazon Bedrock (Claude Sonnet 4)     │   │  │
│  │  │        Converse API + Tool Calling           │   │  │
│  │  │        Multimodal (Text + Images)            │   │  │
│  │  └─────────────────┬───────────────────────────┘   │  │
│  │                    │ Autonomously invokes            │  │
│  │  ┌─────────┐ ┌────┴────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │Profile  │ │Timeline │ │Pattern   │ │Profile  │ │  │
│  │  │Reader   │ │Search   │ │Analyzer  │ │Updater  │ │  │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬────┘ │  │
│  └───────┼───────────┼───────────┼─────────────┼──────┘  │
│          │           │           │             │          │
│  ┌───────┴───────────┴───────────┴─────────────┴───────┐ │
│  │              Amazon DynamoDB (3 Tables)              │ │
│  │   Profiles | Timeline | Conversations               │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Amazon S3 (Image Storage)               │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## How We Used AWS Services

### Amazon Bedrock — The AI Brain

Amazon Bedrock is the foundation of MedAlly's intelligence. We use **Claude Sonnet 4** via the **Converse API** with tool calling — which is what makes this genuinely agentic rather than a simple chatbot.

**How we use it:**

**1. Converse API with Tool Calling**

The Bedrock Converse API allows us to define tools (functions) that the LLM can autonomously decide to invoke. We define 6 tools:

```python
TOOL_DEFINITIONS = [
    {"toolSpec": {"name": "get_health_profile", ...}},
    {"toolSpec": {"name": "search_health_timeline", ...}},
    {"toolSpec": {"name": "log_health_event", ...}},
    {"toolSpec": {"name": "analyze_health_patterns", ...}},
    {"toolSpec": {"name": "update_health_profile", ...}},
]
```

When a user sends a message, we pass it to Bedrock along with these tool definitions. Claude autonomously decides which tools to call based on the conversation context. For example, when a patient reports a new symptom, Claude might:
1. Call `get_health_profile` to check their medications
2. Call `search_health_timeline` to check for related past events
3. Call `log_health_event` to record the new symptom
4. Then generate a personalized response

This multi-step reasoning loop is what makes it agentic — Claude plans and executes a sequence of actions without explicit programming for each scenario.

**2. Streaming with converse_stream**

For a responsive user experience, we use `converse_stream` for the final response. This streams text tokens to the frontend via Server-Sent Events (SSE), giving users a real-time typing effect. We run the Bedrock stream in a separate thread using `asyncio.Queue` to avoid blocking the async event loop:

```python
chunk_queue = asyncio.Queue()
def _run_bedrock_stream():
    for chunk in self.bedrock.converse_stream(messages=messages, ...):
        asyncio.run_coroutine_threadsafe(chunk_queue.put(chunk), loop)

thread = threading.Thread(target=_run_bedrock_stream, daemon=True)
thread.start()

while True:
    chunk = await chunk_queue.get()
    if chunk["type"] == "text":
        yield json.dumps({"type": "text", "text": chunk["text"]})
```

**3. Multimodal Image Analysis**

For skin condition analysis, we include the uploaded image directly in the Bedrock message as base64-encoded content. Claude's vision capabilities analyze the image and provide structured guidance — identifying likely conditions with confidence levels, monitoring advice, and recommendations for when to see a dermatologist.

**4. Cross-Region Inference Profiles**

Since our app is India-focused, we deploy in `ap-south-1` (Mumbai) and use the APAC cross-region inference profile (`apac.anthropic.claude-sonnet-4-20250514-v1:0`) which routes to the nearest available region for optimal latency.

**Key Learning**: Bedrock's Converse API with tool calling is incredibly powerful for building agentic systems. The LLM handles all the routing logic — we just define the tools and their schemas, and Claude figures out when and how to use them. This saved us from building complex if/else routing logic.

---

### Amazon DynamoDB — Persistent Health Memory

DynamoDB serves as MedAlly's "health memory" — the persistent storage that allows the AI to remember and reason over a patient's entire health journey across sessions.

**Three tables, each serving a specific purpose:**

**1. HealthCompanion_Profiles** (Partition Key: `patient_id`)
```json
{
  "patient_id": "abc123",
  "name": "Rahul",
  "age": 42,
  "sex": "Male",
  "medications": [
    {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "start_date": "2026-01-15"}
  ],
  "conditions": ["Type 2 Diabetes", "Hypertension"],
  "allergies": ["Penicillin"],
  "lifestyle_notes": "Sedentary, 8 hours computer daily"
}
```

This profile is injected into Claude's system prompt for every conversation, so the AI always has full context about the patient.

**2. HealthCompanion_Timeline** (Partition Key: `patient_id`, Sort Key: `event_id`)
```json
{
  "event_type": "symptom_reported",
  "display_summary": "Dry cough — 3 days, likely ACE inhibitor related",
  "title": "Persistent dry cough after starting Lisinopril",
  "description": "Patient reports dry cough for 3 days, started after beginning Lisinopril 10mg...",
  "severity": "low",
  "timestamp": "2026-03-01T14:30:00"
}
```

The AI autonomously logs health events here using the `log_health_event` tool. We separate `display_summary` (short, for UI) from `description` (detailed, for AI reasoning).

**3. HealthCompanion_Conversations** (Partition Key: `patient_id`, Sort Key: `message_id`)

Stores the full chat history. This is critical for two reasons:
- **Context continuity**: On page refresh, previous conversations are loaded so the patient doesn't lose their history
- **Pattern analysis**: The `analyze_health_patterns` tool reads both timeline events AND conversation history for richer pattern discovery

**Design Decision — Why DynamoDB over RDS:**
- Flexible schema: Health data is inherently varied — a medication event looks different from a symptom event. DynamoDB's schemaless design handles this naturally.
- Pay-per-request: For a hackathon prototype, we didn't want to provision capacity. On-demand pricing meant zero cost during idle periods.
- Fast key-value lookups: Most operations are "get profile for patient X" or "get all events for patient X" — perfect for DynamoDB's query patterns.

**Key Learning**: We initially used random UUIDs as sort keys for conversations, which caused messages to load in random order on page refresh. We fixed this by sorting by timestamp after fetching — but in retrospect, we should have used timestamp-based sort keys (like ULID) from the start for natural chronological ordering.

---

### Amazon S3 — Medical Image Storage

S3 stores uploaded skin/medical images with associated metadata:

```
s3://health-companion-images-762002729933/
  images/{patient_id}/{image_uuid}.jpeg
  images/{patient_id}/{image_uuid}_meta.json
```

When a patient uploads an image:
1. The image is stored in S3
2. Metadata (patient_id, timestamp, upload context) is saved alongside it
3. An `image_uploaded` event is logged to the DynamoDB Timeline
4. The image bytes are sent to Bedrock as base64 for multimodal analysis

**Key Learning**: S3 bucket names must be globally unique. We appended our AWS account ID to avoid collisions.

---

### Amazon EC2 — Compute & Hosting

We deploy everything on a single `t3.medium` instance in `ap-south-1`:

- **Nginx** as reverse proxy (SSL termination + static file serving + API proxying)
- **FastAPI/Uvicorn** as the Python backend (port 8000)
- **React build** served as static files from Nginx
- **systemd service** for auto-restart and boot persistence

**IAM Role** (`HealthCompanionEC2Role`) with instance profile provides credentials automatically — no hardcoded access keys. Policies: `AmazonBedrockFullAccess`, `AmazonDynamoDBFullAccess`, `AmazonS3FullAccess`.

**HTTPS** via Let's Encrypt (Certbot) + DuckDNS for free domain (`medally.duckdns.org`).

**Key Learning**: EC2 instance profiles are the right way to provide AWS credentials to applications running on EC2. The boto3 SDK automatically picks up the credentials from the instance metadata service — zero configuration needed in the application code.

---

## The Agentic Architecture — Deep Dive

The heart of MedAlly is the **agentic loop** in our orchestrator. Here's how it works for a real scenario:

**Patient says**: "I started Lisinopril 3 days ago and now I have a persistent dry cough. Should I be worried?"

```
┌─ ITERATION 1 ─────────────────────────────────────────┐
│ Orchestrator sends message to Bedrock with tools       │
│ Claude decides: "I need this patient's health profile" │
│ → Calls: get_health_profile                            │
│ → Gets: Metformin 500mg, Lisinopril 10mg, Diabetes    │
│ Tool result sent back to Claude                        │
└────────────────────────────────────────────────────────┘
           │
┌─ ITERATION 2 ─────────────────────────────────────────┐
│ Claude now has profile, decides: "Check timeline too"  │
│ → Calls: search_health_timeline                        │
│ → Gets: No prior cough reports                         │
│ Also: "I should log this new symptom"                  │
│ → Calls: log_health_event                              │
│ → Saves: "Dry cough, 3 days, possible ACE inhibitor"  │
│ Tool results sent back to Claude                       │
└────────────────────────────────────────────────────────┘
           │
┌─ ITERATION 3 ─────────────────────────────────────────┐
│ Claude has all context, generates final response:      │
│ "Based on your profile, dry cough is a very common     │
│  ACE inhibitor side effect (~10% of patients). Given   │
│  you started Lisinopril just 3 days ago alongside      │
│  your Metformin for diabetes, this is expected..."     │
│ → ✅ Reassurance urgency badge                         │
│ Response streamed to user via SSE                      │
└────────────────────────────────────────────────────────┘
```

What makes this genuinely agentic:
- **Autonomous tool selection**: We don't program which tools to call for which message. Claude decides.
- **Multi-step reasoning**: Up to 6 iterations of plan → execute → observe → decide.
- **Proactive behavior**: Claude logs events and updates profiles without being asked.
- **Goal-directed**: Claude plans a sequence of actions to achieve the best response.

---

## Key Features Built

1. **Auto Health Profile Building**: Tell the AI "I'm Rahul, 42, I take Metformin for diabetes" — it automatically extracts and saves name, age, medication, and condition to your profile.

2. **Side Effect Reality Checker**: Reports new symptoms? The AI cross-references against your medication timeline, evaluates timing and severity, and provides urgency-categorized guidance (Reassurance / Monitor / See Doctor / Urgent).

3. **Medical Information Noise Filter**: Share a scary health article and the AI contextualizes it for YOUR specific situation — explaining absolute vs relative risk and why the statistic may or may not apply to you.

4. **Skin Image Analysis**: Upload a skin photo for multimodal AI analysis. Identifies likely conditions with confidence levels and monitoring guidance.

5. **Pattern Discovery**: Analyzes your entire health timeline and conversation history to find correlations — symptom triggers, medication timing effects, recurring patterns.

6. **Voice Input**: Browser-native speech recognition for hands-free interaction.

7. **Real-time Streaming**: Word-by-word response streaming with visible tool-call indicators showing the agentic workflow in action.

---

## Key Learnings

### 1. Bedrock's Tool Calling Is Production-Ready for Agentic Systems
We were initially skeptical about whether tool calling could handle complex multi-step health reasoning. It exceeded our expectations. Claude Sonnet 4 consistently makes intelligent decisions about which tools to invoke and in what order — even for nuanced scenarios like distinguishing chronic conditions (profile) from acute symptoms (timeline).

### 2. The "Agents as Tools" Pattern Is Pragmatic
Instead of building separate agent processes with complex orchestration, we implemented each "agent" as a tool function. The LLM itself acts as the supervisor/orchestrator. This is simpler to build, debug, and deploy than frameworks like LangGraph or CrewAI — and in our experience, equally capable for our use case.

### 3. Message Format Differences Between Bedrock and Anthropic APIs Matter
The Bedrock Converse API and the direct Anthropic Messages API have subtle format differences (e.g., Bedrock content blocks don't have a `type` field, while Anthropic requires it). We built a message sanitizer that strips incompatible fields before sending to Bedrock — a critical detail when supporting both providers.

### 4. DynamoDB Sort Key Design Impacts Query Patterns
Using random UUIDs as sort keys meant we couldn't get chronologically ordered results from DynamoDB queries. We had to add application-level sorting by timestamp. For future iterations, we'd use timestamp-based keys (ULID or ISO timestamp) as sort keys.

### 5. IST Timestamps for India-Focused Apps
We initially stored UTC timestamps, which caused confusion in the UI ("5 hours ago" for a message sent just now). Switching to IST storage with `datetime.now(timezone(timedelta(hours=5, minutes=30)))` immediately fixed the user experience for our Indian audience.

### 6. EC2 Instance Profiles > Hardcoded Credentials
Using IAM roles with instance profiles means the application never touches AWS credentials directly. `boto3` automatically discovers them from the instance metadata. This is more secure and eliminates credential rotation concerns.

### 7. Streaming Requires Careful Thread Management
Bedrock's streaming API is synchronous (blocking), but our FastAPI backend is async. We bridged this with `asyncio.Queue` + `threading.Thread` — the Bedrock stream runs in a background thread, pushes chunks to a queue, and the async generator yields them to the SSE response.

---

## What's Next

- **Multi-language support**: Hindi and regional language chat using Bedrock's multilingual capabilities
- **Wearable data integration**: Ingest data from fitness trackers for richer pattern analysis
- **Doctor's view**: A read-only portal where patients can share their health timeline with their physician
- **Medication adherence tracking**: Proactive reminders and compliance monitoring

---

## Team SegFault

Built for the **AI for Bharat Hackathon** — Healthcare & Life Sciences track.

- Sushant Nanda
- Achintya Sharma

**Live at**: [https://medally.duckdns.org](https://medally.duckdns.org)  
**GitHub**: [github.com/sharmaachintya/Team-SegFault-Patient-Centric-AI-HealthCompanion](https://github.com/sharmaachintya/Team-SegFault-Patient-Centric-AI-HealthCompanion)

---

*MedAlly is a hackathon prototype. It is not a medical device and should never be used for actual medical decisions. Always consult qualified healthcare professionals.*
