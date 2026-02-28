/**
 * API Client for AI Health Companion backend.
 */
const API_BASE = '/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error (${res.status}): ${error}`);
  }
  return res.json();
}

// Profile
export async function createProfile() {
  return request('/profile/create', { method: 'POST' });
}

export async function getProfile(patientId) {
  return request(`/profile/${patientId}`);
}

export async function updateProfile(patientId, data) {
  return request(`/profile/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Chat (non-streaming fallback)
export async function sendMessage(patientId, message, conversationHistory = []) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      patient_id: patientId,
      message,
      conversation_history: conversationHistory,
    }),
  });
}

// Chat with streaming
export async function sendMessageStream(patientId, message, conversationHistory = [], onChunk) {
  const url = `${API_BASE}/chat/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_id: patientId,
      message,
      conversation_history: conversationHistory,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error (${res.status}): ${error}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let urgencyLevel = null;
  let newTimelineEvents = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle SSE format: "data: {...}"
      const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
      if (!jsonStr) continue;

      try {
        const data = JSON.parse(jsonStr);

        if (data.type === 'text') {
          fullText += data.text;
          onChunk({ type: 'text', text: data.text, fullText });
        } else if (data.type === 'tool_call') {
          onChunk({ type: 'tool_call', name: data.name });
        } else if (data.type === 'done') {
          urgencyLevel = data.urgency_level;
          newTimelineEvents = data.new_timeline_events || [];
          fullText = data.full_text || fullText;
          onChunk({ type: 'done', fullText, urgencyLevel, newTimelineEvents });
        } else if (data.type === 'error') {
          throw new Error(data.message);
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
        // Skip malformed JSON chunks
      }
    }
  }

  return { response: fullText, urgency_level: urgencyLevel, new_timeline_events: newTimelineEvents };
}

export async function sendImageMessage(patientId, message, imageFile) {
  const formData = new FormData();
  formData.append('patient_id', patientId);
  formData.append('message', message);
  formData.append('image', imageFile);

  const url = `${API_BASE}/chat/image`;
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error (${res.status}): ${error}`);
  }
  return res.json();
}

// Timeline
export async function getTimeline(patientId) {
  return request(`/timeline/${patientId}`);
}

export async function addTimelineEvent(patientId, event) {
  return request(`/timeline/${patientId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function deleteTimelineEvent(patientId, eventId) {
  return request(`/timeline/${patientId}/events/${eventId}`, {
    method: 'DELETE',
  });
}

// Conversations
export async function getConversations(patientId) {
  return request(`/conversations/${patientId}`);
}

export async function clearConversations(patientId) {
  return request(`/conversations/${patientId}`, { method: 'DELETE' });
}

// Health check
export async function healthCheck() {
  return request('/health');
}
