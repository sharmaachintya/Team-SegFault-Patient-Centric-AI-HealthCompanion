# Design Document
## AI Health Companion - Agentic Architecture & System Design

---

## 1. System Overview

The AI Health Companion is built on **agentic AI principles**, where multiple specialized, autonomous agents collaborate to provide intelligent, context-aware health guidance. Unlike traditional chatbot architectures that rely on simple prompt-response patterns, our system employs goal-directed agents that can reason, plan, and coordinate to accomplish complex health-understanding tasks.

### Core Design Philosophy
- **Multi-agent collaboration** over monolithic models
- **Longitudinal reasoning** over isolated question-answering
- **Proactive analysis** alongside reactive responses
- **Context-aware intelligence** that improves over time
- **Safety-first design** with clear non-diagnostic boundaries

---

## 2. Agentic Architecture

### 2.1 Supervisor Agent (Orchestrator)

The **Supervisor Agent** serves as the intelligent coordinator of the entire system. It operates at the conversation level, managing user interactions and delegating tasks to specialized agents.

**Responsibilities:**
- Receives and interprets all user inputs (text, voice, images)
- Determines which specialized agent(s) should handle each request
- Maintains conversation state and context flow
- Coordinates multi-agent collaboration when multiple agents are needed
- Synthesizes responses from specialized agents into natural, coherent replies
- Ensures safety guardrails are maintained across all agent outputs
- Handles edge cases and gracefully manages uncertainty

**Key Characteristics:**
- **Goal-directed:** Understands user intent and plans appropriate agent coordination
- **Adaptive:** Routes dynamically based on conversation context, not rigid rules
- **Transparent:** Manages complexity invisibly - users see one unified conversation
- **Safety-conscious:** Final arbiter for all medical escalation decisions

---

### 2.2 Specialized Agents

Each specialized agent is an autonomous unit with distinct capabilities, knowledge domain, and operational patterns. Agents communicate through the supervisor and can access shared patient context.

#### **Agent 1: Context Memory Agent**

**Purpose:** Maintains and manages the longitudinal patient health profile.

**Autonomous Behaviors:**
- Continuously extracts structured health information from conversations (medications, symptoms, events)
- Updates patient context database in real-time as new information emerges
- Identifies contradictions or gaps in health history and prompts clarification
- Provides relevant historical context to other agents upon request
- Tracks temporal relationships between health events

**Data Maintained:**
- Medication timeline (start dates, dosages, discontinuations)
- Symptom history (onset, duration, severity, resolution)
- Medical events (procedures, diagnoses, hospitalizations)
- Lifestyle factors (diet changes, exercise patterns, stress events)
- Image history (skin photos with timestamps and context)

**Agentic Characteristics:**
- **Proactive context retrieval:** Anticipates what historical information is relevant
- **Self-updating:** Continuously refines patient profile without explicit commands
- **Conflict resolution:** Identifies and resolves inconsistencies in patient timeline

---

#### **Agent 2: Pattern Discovery Agent**

**Purpose:** Autonomously analyzes patient history to detect meaningful health patterns.

**Autonomous Behaviors:**
- Runs continuous background analysis on patient health timeline
- Identifies temporal correlations (symptom patterns, medication side effects)
- Detects recurrences and cyclical patterns (seasonal, monthly, situational)
- Recognizes changes in symptom characteristics over time
- Surfaces relevant patterns when they provide value to current conversations

**Pattern Types Detected:**
- Medication side effect correlations (symptom onset timing relative to new meds)
- Symptom triggers (environmental, dietary, stress-related)
- Temporal patterns (time-of-day, seasonal variations)
- Symptom evolution (increasing/decreasing severity or frequency)
- Multi-symptom relationships (comorbid patterns)

**Agentic Characteristics:**
- **Autonomous operation:** Runs independently without user prompting
- **Selective communication:** Only surfaces patterns when contextually relevant
- **Evidence-based:** Distinguishes statistical patterns from random coincidence
- **Non-diagnostic focus:** Identifies correlations, never causal diagnoses

---

#### **Agent 3: Symptom Reasoning Agent**

**Purpose:** Provides context-aware interpretation of symptoms, particularly potential medication side effects.

**Autonomous Behaviors:**
- Analyzes new symptoms against patient's medication timeline
- Compares symptom severity to patient's personal baseline
- Considers temporal factors (symptom onset timing, medication changes)
- Evaluates symptom evolution (worsening, improving, stable)
- Determines appropriate response level (reassurance, monitoring, escalation)

**Decision Framework:**
- **Reassurance:** Common, expected side effects within normal severity range
- **Monitoring:** Symptoms that warrant observation with clear watch-for criteria
- **Medical consultation:** Unusual symptoms, rapid changes, or concerning patterns
- **Urgent care:** Red flag symptoms requiring immediate medical attention

**Agentic Characteristics:**
- **Contextual reasoning:** Evaluates symptoms within full patient context, not in isolation
- **Risk stratification:** Autonomously determines urgency level
- **Personalized baselines:** Considers individual variation in symptom experience
- **Safety-first bias:** Escalates when uncertain rather than minimizing concerns

---

#### **Agent 4: Information Contextualization Agent**

**Purpose:** Helps patients interpret medical information from external sources within their personal health context.

**Autonomous Behaviors:**
- Analyzes medical information or statistics provided by patients
- Evaluates relevance to the patient's specific health profile
- Distinguishes between general population data and individual applicability
- Identifies misleading or oversimplified health information
- Provides personalized context to reduce inappropriate anxiety

**Reasoning Approach:**
- Assess source credibility and recency of information
- Identify relevant vs. irrelevant risk factors for this patient
- Explain probabilistic thinking in accessible terms
- Distinguish between correlation and causation in health claims
- Maintain appropriate caution without creating unnecessary fear

**Agentic Characteristics:**
- **Critical evaluation:** Assesses quality and relevance of external information
- **Personalization:** Contextualizes general information to individual circumstances
- **Health literacy support:** Helps patients develop better information evaluation skills
- **Balanced perspective:** Reduces panic while maintaining appropriate vigilance

---

#### **Agent 5: Visual Analysis Agent**

**Purpose:** Analyzes skin images to provide safe, non-diagnostic guidance on monitoring and escalation.

**Autonomous Behaviors:**
- Processes uploaded skin images for visual characteristics
- Tracks changes across multiple images over time
- Identifies features that warrant medical evaluation
- Provides structured monitoring guidance (what to watch for)
- Determines appropriate timeframes for dermatologist consultation

**Visual Analysis Focus:**
- Color patterns and changes
- Size and growth tracking
- Texture and surface characteristics
- Border regularity and changes
- Temporal evolution across images

**Safety-First Constraints:**
- **Never names diseases:** Describes visual characteristics only
- **Never prescribes treatment:** Provides monitoring and escalation guidance only
- **Errs toward caution:** Recommends evaluation when uncertain
- **Clear timeframes:** Specifies when to seek care (urgent vs. routine appointment)

**Agentic Characteristics:**
- **Longitudinal tracking:** Monitors changes across image history automatically
- **Feature-based reasoning:** Focuses on observable characteristics, not diagnoses
- **Adaptive escalation:** Adjusts urgency based on rate of change and concerning features
- **Patient empowerment:** Helps patients communicate visual changes to healthcare providers

---

## 3. Agent Orchestration & Collaboration

### 3.1 Interaction Patterns

**Single Agent Routing:**
When user input clearly maps to one agent's domain, the Supervisor directly routes to that agent and returns its response.

*Example:* User asks, "What medications am I currently taking?" → Context Memory Agent retrieves and returns medication list.

**Multi-Agent Collaboration:**
Complex queries may require multiple agents working together, coordinated by the Supervisor.

*Example:* User says, "I have a new headache, and I read online that my medication can cause brain bleeding."

1. **Supervisor** identifies need for Symptom Reasoning Agent and Information Contextualization Agent
2. **Context Memory Agent** provides medication timeline and symptom history
3. **Symptom Reasoning Agent** evaluates headache in context (timing, severity vs. baseline)
4. **Information Contextualization Agent** addresses the "brain bleeding" concern with appropriate context
5. **Supervisor** synthesizes coherent response addressing both symptom evaluation and information anxiety

**Background Agent Operation:**
Pattern Discovery Agent runs continuously in background, independent of user interactions. It surfaces findings only when relevant to active conversations.

### 3.2 Context Sharing

All agents have access to shared patient context maintained by the Context Memory Agent. This enables:
- Consistent reasoning across all agent responses
- Elimination of redundant information requests from users
- Longitudinal intelligence that improves over time
- Personalized guidance based on individual health history

### 3.3 Safety Coordination

The Supervisor Agent enforces safety guardrails across all agent outputs:
- Validates that no agent is making diagnoses or treatment recommendations
- Ensures appropriate escalation for urgent symptoms
- Maintains consistent messaging about the system's role as a companion, not a replacement for medical care
- Flags and handles edge cases that fall outside agent capabilities

---

## 4. AWS Services Integration

The system leverages AWS services to enable scalable, secure, and intelligent agent operations.

### 4.1 Amazon Bedrock (GenAI Foundation)

**Role:** Powers the intelligence of all agents through foundation models.

**Usage:**
- **Supervisor Agent:** Uses Claude or other LLMs for intent understanding, conversation management, and response synthesis
- **Specialized Agents:** Each agent utilizes Bedrock models for reasoning, analysis, and decision-making within their domain
- **Prompt engineering:** Custom system prompts for each agent define their role, constraints, and operational guidelines
- **Safety guardrails:** Bedrock's built-in safety features provide first line of defense against medical overreach

**Key Benefits:**
- Access to state-of-the-art foundation models without infrastructure overhead
- Built-in safety and content filtering capabilities
- Scalable inference for multi-agent concurrent operations
- Support for multimodal inputs (text, images) for Visual Analysis Agent

---

### 4.2 Amazon DynamoDB (Health Memory Storage)

**Role:** Persistent storage for longitudinal patient health context.

**Data Structure:**
```
Patient Profile Table:
- PatientID (partition key)
- Timestamp (sort key)
- EventType (medication, symptom, conversation, image)
- EventData (JSON structure with event details)
- Metadata (tags, relationships, flags)
```

**Usage:**
- **Context Memory Agent:** Writes all health events and conversation extracts
- **Pattern Discovery Agent:** Queries historical data for temporal analysis
- **All Agents:** Read access to retrieve relevant patient context

**Key Benefits:**
- Flexible NoSQL schema accommodates diverse health data types
- Fast queries for recent context retrieval during conversations
- Time-series capabilities for temporal pattern analysis
- Scalable storage for growing patient histories over months/years

---

### 4.3 Amazon S3 (Medical Image Storage)

**Role:** Secure storage for uploaded skin condition images.

**Usage:**
- **Visual Analysis Agent:** Retrieves images for analysis and comparison
- **Context Memory Agent:** Links image metadata to patient timeline
- **Versioning:** Maintains image history for longitudinal tracking of skin changes

**Organization:**
```
s3://health-companion/
  ├── images/
  │   ├── {PatientID}/
  │   │   ├── {ImageID}_original.jpg
  │   │   ├── {ImageID}_metadata.json
  │   │   └── {Timestamp}/
```

**Key Benefits:**
- Secure, encrypted storage for sensitive medical images
- Cost-effective for large image files
- Integration with Bedrock for multimodal image analysis
- Compliance-ready architecture for healthcare data

---

## 5. Data Flow Architecture

### 5.1 Typical Conversation Flow

```
User Input (Text/Voice/Image)
    ↓
Supervisor Agent (Intent Analysis)
    ↓
Context Memory Agent (Retrieve Relevant History)
    ↓
Specialized Agent(s) (Domain-Specific Reasoning)
    ↓
Supervisor Agent (Response Synthesis + Safety Check)
    ↓
User Response
```

### 5.2 Background Pattern Analysis Flow

```
Context Memory Agent (New Event Written to DynamoDB)
    ↓
Pattern Discovery Agent (Periodic Background Analysis)
    ↓
Pattern Detected (Stored with Confidence Score)
    ↓
Supervisor Agent (Surfaces Pattern When Contextually Relevant)
    ↓
User Insight Delivery
```

### 5.3 Image Analysis Flow

```
User Uploads Skin Image
    ↓
Supervisor Agent (Routes to Visual Analysis)
    ↓
Image Stored in S3 + Metadata in DynamoDB
    ↓
Visual Analysis Agent (Bedrock Multimodal Analysis)
    ↓
Historical Images Retrieved (Comparison Analysis)
    ↓
Monitoring Guidance Generated
    ↓
Supervisor Returns Guidance to User
```

---

## 6. Responsible AI Design Principles

### 6.1 Non-Diagnostic Boundaries

**Agent-Level Enforcement:**
- Each agent's system prompt explicitly forbids disease naming and treatment recommendations
- Agents are trained to describe symptoms/features rather than label conditions
- Escalation to healthcare providers is preferred over attempting medical conclusions

**Supervisor-Level Validation:**
- Final safety check before any response reaches the user
- Automatic flagging and rephrasing if diagnostic language detected
- Clear communication of system limitations in every interaction

### 6.2 Bias Mitigation

- Foundation models (Bedrock) selected for robust safety and fairness properties
- Context-aware reasoning reduces demographic bias by personalizing to individual history
- Escalation decisions based on symptom characteristics, not patient demographics
- Continuous monitoring for disparities in escalation recommendations

### 6.3 Transparency & Explainability

- Agents provide reasoning for recommendations ("Given that you started this medication 3 days ago and headaches are a common side effect...")
- Clear confidence levels communicated when uncertain
- Users can ask "why" questions about any guidance provided
- System limitations communicated proactively

### 6.4 Human-in-the-Loop

- System supports but never replaces medical professionals
- All escalation paths lead to qualified healthcare providers
- System encourages users to share conversation history with doctors
- Export functionality for sharing health timeline with medical team

---

## 7. Innovation Highlights

### 7.1 Agentic AI Advancement

This system demonstrates cutting-edge agentic AI through:
- **Multi-agent orchestration** with autonomous specialized agents
- **Goal-directed reasoning** beyond simple prompt-response
- **Proactive intelligence** (Pattern Discovery Agent operates independently)
- **Contextual adaptation** rather than rigid rule-based routing
- **Collaborative problem-solving** across agent boundaries

### 7.2 Real-World Healthcare Impact

- Addresses genuine patient pain points in healthcare navigation
- Reduces inappropriate anxiety while maintaining safety
- Empowers patients with better health information literacy
- Complements rather than replaces medical professionals
- Scales personalized health guidance beyond traditional care models

### 7.3 Responsible Innovation

- Demonstrates how advanced AI can be deployed safely in sensitive domains
- Clear ethical boundaries prevent medical overreach
- Privacy-first architecture with secure data handling
- Transparent reasoning builds trust and health literacy
- Safety guardrails at multiple architectural layers

---

## 8. Technical Scalability

### 8.1 Agent Independence

Each specialized agent can be developed, tested, and improved independently without disrupting the overall system. New agents can be added to expand capabilities (e.g., nutrition guidance, medication adherence support).

### 8.2 Cloud-Native Architecture

AWS services provide:
- **Serverless scaling** for variable conversation loads
- **Global availability** for multi-region deployment
- **Managed services** reduce operational overhead
- **Security compliance** for healthcare data requirements

### 8.3 Continuous Learning

Agent prompts and reasoning strategies can be refined based on:
- User feedback on response quality
- Medical expert review of escalation decisions
- Pattern discovery accuracy validation
- Safety incident analysis and prevention

---

## Conclusion

This AI Health Companion represents a new paradigm in patient-facing health technology - one that leverages agentic AI principles to provide intelligent, context-aware, and safe health guidance. Through sophisticated multi-agent orchestration, longitudinal reasoning, and responsible design, the system addresses real patient needs while maintaining clear ethical boundaries. Built on AWS's robust infrastructure (Bedrock, DynamoDB, S3), the architecture is both technically sophisticated and practically deployable, demonstrating how advanced AI can be applied responsibly in healthcare contexts.
