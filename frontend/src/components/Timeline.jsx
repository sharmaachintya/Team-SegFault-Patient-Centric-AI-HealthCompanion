import React, { useState } from 'react'
import { RefreshCw, Pill, AlertTriangle, Activity, Camera, Lightbulb, Heart, Trash2, ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react'
import { deleteTimelineEvent } from '../api/client'

const EVENT_ICONS = {
  medication_started: { icon: Pill, color: 'emerald', bgClass: 'bg-emerald-100', iconClass: 'text-emerald-600', dotClass: 'bg-emerald-400', label: 'Medication Started' },
  medication_stopped: { icon: Pill, color: 'gray', bgClass: 'bg-gray-100', iconClass: 'text-gray-500', dotClass: 'bg-gray-400', label: 'Medication Stopped' },
  symptom_reported: { icon: AlertTriangle, color: 'amber', bgClass: 'bg-amber-100', iconClass: 'text-amber-600', dotClass: 'bg-amber-400', label: 'Symptom Reported' },
  symptom_resolved: { icon: Heart, color: 'green', bgClass: 'bg-green-100', iconClass: 'text-green-600', dotClass: 'bg-green-400', label: 'Symptom Resolved' },
  condition_noted: { icon: Activity, color: 'orange', bgClass: 'bg-orange-100', iconClass: 'text-orange-600', dotClass: 'bg-orange-400', label: 'Condition Noted' },
  lifestyle_change: { icon: Activity, color: 'blue', bgClass: 'bg-blue-100', iconClass: 'text-blue-600', dotClass: 'bg-blue-400', label: 'Lifestyle Change' },
  insight: { icon: Lightbulb, color: 'purple', bgClass: 'bg-purple-100', iconClass: 'text-purple-600', dotClass: 'bg-purple-400', label: 'AI Insight' },
  image_uploaded: { icon: Camera, color: 'indigo', bgClass: 'bg-indigo-100', iconClass: 'text-indigo-600', dotClass: 'bg-indigo-400', label: 'Image Uploaded' },
}

const SEVERITY_STYLES = {
  low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  high: 'bg-orange-50 text-orange-700 border border-orange-200',
  urgent: 'bg-red-50 text-red-700 border border-red-200',
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
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-indigo-500" />
          Health Timeline
        </h3>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-all active:scale-95"
          title="Refresh timeline"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Event Count Badge */}
      {events.length > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-indigo-700">{events.length} health event{events.length !== 1 ? 's' : ''} tracked</span>
        </div>
      )}

      {events.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Activity className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 font-bold">No events yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
            Your health timeline will build automatically as you chat with MedAlly.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-indigo-200 via-blue-200 to-emerald-200 rounded-full" />

          <div className="space-y-3">
            {events.map((event, idx) => (
              <TimelineCard
                key={event.event_id || idx}
                event={event}
                onDelete={handleDelete}
                formatDate={formatDate}
                index={idx}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function TimelineCard({ event, onDelete, formatDate, index }) {
  const [expanded, setExpanded] = useState(false)
  const config = EVENT_ICONS[event.event_type] || EVENT_ICONS.insight
  const IconComponent = config.icon

  const summary = event.display_summary || event.title
  const hasDetails = event.title || event.description

  return (
    <div className="relative pl-10 group" style={{ animationDelay: `${index * 50}ms` }}>
      {/* Timeline dot */}
      <div className={`absolute left-[9px] top-3 w-3.5 h-3.5 rounded-full ${config.dotClass} border-2 border-white shadow-sm timeline-dot-animate z-10`} />

      <div className="bg-white border border-gray-100 rounded-xl p-3 hover:shadow-md transition-all duration-200 hover:border-gray-200">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-lg ${config.bgClass} flex items-center justify-center shrink-0`}>
              <IconComponent className={`w-3 h-3 ${config.iconClass}`} />
            </div>
            <span className="text-[11px] font-semibold text-gray-400 truncate">{config.label}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {event.severity && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${SEVERITY_STYLES[event.severity] || ''}`}>
                {event.severity}
              </span>
            )}
            <button
              onClick={() => onDelete(event.event_id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg transition-all"
              title="Delete event"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          </div>
        </div>

        {/* Display summary */}
        <h4 className="text-sm font-semibold text-gray-800 mt-1.5 leading-snug">{summary}</h4>

        {/* Expandable details */}
        {hasDetails && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-[11px] text-gray-400 hover:text-indigo-500 transition-colors font-medium"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{expanded ? 'Hide details' : 'Show details'}</span>
            </button>

            {expanded && (
              <div className="mt-2 pl-2.5 border-l-2 border-indigo-200 space-y-1 msg-animate-fade">
                {event.title && event.title !== summary && (
                  <p className="text-xs text-gray-600"><span className="font-semibold">Title:</span> {event.title}</p>
                )}
                {event.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">{event.description}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[10px] text-gray-400 font-medium">{formatDate(event.timestamp)}</span>
          {event.source === 'system' && (
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-md border border-indigo-100">
              AI logged
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
