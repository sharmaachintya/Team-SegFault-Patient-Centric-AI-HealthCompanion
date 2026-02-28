import React, { useState } from 'react'
import { RefreshCw, Pill, AlertTriangle, Activity, Camera, Lightbulb, Heart, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { deleteTimelineEvent } from '../api/client'

const EVENT_ICONS = {
  medication_started: { icon: Pill, color: 'emerald', label: 'Medication Started' },
  medication_stopped: { icon: Pill, color: 'gray', label: 'Medication Stopped' },
  symptom_reported: { icon: AlertTriangle, color: 'amber', label: 'Symptom Reported' },
  symptom_resolved: { icon: Heart, color: 'green', label: 'Symptom Resolved' },
  condition_noted: { icon: Activity, color: 'orange', label: 'Condition Noted' },
  lifestyle_change: { icon: Activity, color: 'blue', label: 'Lifestyle Change' },
  insight: { icon: Lightbulb, color: 'purple', label: 'AI Insight' },
  image_uploaded: { icon: Camera, color: 'indigo', label: 'Image Uploaded' },
}

const SEVERITY_COLORS = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export default function Timeline({ patientId, events, onRefresh }) {
  async function handleDelete(eventId) {
    try {
      await deleteTimelineEvent(patientId, eventId)
      onRefresh()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return ''
    try {
      const d = new Date(timestamp)
      const now = new Date()
      const diffMs = now - d
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return timestamp
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 text-sm">Health Timeline</h3>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh timeline"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No events yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Your health timeline will build automatically as you chat with the AI companion.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-3">
            {events.map((event, idx) => (
              <TimelineCard
                key={event.event_id || idx}
                event={event}
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function TimelineCard({ event, onDelete, formatDate }) {
  const [expanded, setExpanded] = useState(false)
  const config = EVENT_ICONS[event.event_type] || EVENT_ICONS.insight
  const IconComponent = config.icon

  // Use display_summary if available, otherwise fall back to title
  const summary = event.display_summary || event.title
  const hasDetails = event.title || event.description

  return (
    <div className="relative pl-10 group">
      {/* Timeline dot */}
      <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white bg-${config.color}-400 shadow-sm`} />

      <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <IconComponent className={`w-3.5 h-3.5 text-${config.color}-500 shrink-0`} />
            <span className="text-xs font-medium text-gray-500 truncate">{config.label}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {event.severity && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${SEVERITY_COLORS[event.severity] || ''}`}>
                {event.severity}
              </span>
            )}
            <button
              onClick={() => onDelete(event.event_id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
              title="Delete event"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        </div>

        {/* Display summary (main text shown) */}
        <h4 className="text-sm font-medium text-gray-800 mt-1">{summary}</h4>

        {/* Expandable details */}
        {hasDetails && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{expanded ? 'Hide details' : 'Show details'}</span>
            </button>

            {expanded && (
              <div className="mt-2 pl-2 border-l-2 border-gray-200 space-y-1">
                {event.title && event.title !== summary && (
                  <p className="text-xs text-gray-600"><span className="font-medium">Title:</span> {event.title}</p>
                )}
                {event.description && (
                  <p className="text-xs text-gray-500">{event.description}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-gray-400">{formatDate(event.timestamp)}</span>
          {event.source === 'system' && (
            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">AI logged</span>
          )}
        </div>
      </div>
    </div>
  )
}
