import React, { useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line
} from 'recharts'
import {
  BarChart3, Activity, TrendingUp, AlertTriangle, Pill,
  Heart, Camera, Lightbulb, Zap, Calendar, Shield
} from 'lucide-react'

// ============================================
// Color Palette
// ============================================
const COLORS = {
  medication_started: '#10b981',
  medication_stopped: '#9ca3af',
  symptom_reported: '#f59e0b',
  symptom_resolved: '#22c55e',
  condition_noted: '#f97316',
  lifestyle_change: '#3b82f6',
  insight: '#8b5cf6',
  image_uploaded: '#6366f1',
}

const SEVERITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
}

const EVENT_LABELS = {
  medication_started: 'Medication Started',
  medication_stopped: 'Medication Stopped',
  symptom_reported: 'Symptom Reported',
  symptom_resolved: 'Symptom Resolved',
  condition_noted: 'Condition Noted',
  lifestyle_change: 'Lifestyle Change',
  insight: 'AI Insight',
  image_uploaded: 'Image Upload',
}

// ============================================
// Custom Tooltip
// ============================================
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color || entry.fill }} className="font-medium">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

// ============================================
// Main HealthInsights Component
// ============================================
export default function HealthInsights({ events = [], profile }) {
  // -------- Derived Data --------
  const stats = useMemo(() => {
    if (!events.length) return null

    const now = new Date()
    const firstEvent = events.length ? new Date(events[events.length - 1]?.timestamp || now) : now
    const daysDiff = Math.max(1, Math.ceil((now - firstEvent) / 86400000))

    // Event type counts
    const typeCounts = {}
    events.forEach(e => {
      const t = e.event_type || 'insight'
      typeCounts[t] = (typeCounts[t] || 0) + 1
    })

    // Severity counts
    const severityCounts = { low: 0, medium: 0, high: 0, urgent: 0 }
    events.forEach(e => {
      if (e.severity && severityCounts[e.severity] !== undefined) {
        severityCounts[e.severity]++
      }
    })

    // Events per day (last 7 days)
    const dailyData = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().split('T')[0]
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = events.filter(e => {
        if (!e.timestamp) return false
        return e.timestamp.startsWith(dayStr)
      }).length
      dailyData.push({ day: dayLabel, date: dayStr, events: count })
    }

    // Events over time (group by date)
    const timelineMap = {}
    events.forEach(e => {
      if (!e.timestamp) return
      const date = e.timestamp.split('T')[0]
      if (!timelineMap[date]) {
        timelineMap[date] = { date, symptoms: 0, medications: 0, other: 0, total: 0 }
      }
      timelineMap[date].total++
      if (e.event_type === 'symptom_reported' || e.event_type === 'symptom_resolved') {
        timelineMap[date].symptoms++
      } else if (e.event_type === 'medication_started' || e.event_type === 'medication_stopped') {
        timelineMap[date].medications++
      } else {
        timelineMap[date].other++
      }
    })
    const timelineData = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date))

    // Format timeline dates for display
    timelineData.forEach(d => {
      const dt = new Date(d.date)
      d.label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })

    // Pie chart data
    const pieData = Object.entries(typeCounts).map(([key, value]) => ({
      name: EVENT_LABELS[key] || key,
      value,
      color: COLORS[key] || '#6b7280',
    }))

    // Severity bar data
    const severityData = Object.entries(severityCounts)
      .filter(([_, v]) => v > 0)
      .map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        color: SEVERITY_COLORS[key],
      }))

    // Most common event type
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]

    return {
      totalEvents: events.length,
      daysTracked: daysDiff,
      typeCounts,
      severityCounts,
      dailyData,
      timelineData,
      pieData,
      severityData,
      topType: topType ? { type: EVENT_LABELS[topType[0]] || topType[0], count: topType[1] } : null,
      symptomCount: (typeCounts['symptom_reported'] || 0) + (typeCounts['symptom_resolved'] || 0),
      medCount: (typeCounts['medication_started'] || 0) + (typeCounts['medication_stopped'] || 0),
    }
  }, [events])

  // -------- Empty State --------
  if (!events.length || !stats) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-4">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          <h3 className="font-bold text-gray-800 text-sm">Health Insights</h3>
        </div>
        <div className="text-center py-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="text-sm text-gray-500 font-bold">No insights yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
            Visual health analytics will appear here as MedAlly tracks your health events.
          </p>
        </div>
      </div>
    )
  }

  // -------- Main Render --------
  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <BarChart3 className="w-4 h-4 text-indigo-500" />
        <h3 className="font-bold text-gray-800 text-sm">Health Insights</h3>
      </div>

      {/* ============ Quick Stats ============ */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Events"
          value={stats.totalEvents}
          icon={<Zap className="w-3.5 h-3.5 text-indigo-500" />}
          gradient="from-indigo-50 to-blue-50"
          border="border-indigo-100"
        />
        <StatCard
          label="Symptoms"
          value={stats.symptomCount}
          icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          gradient="from-amber-50 to-orange-50"
          border="border-amber-100"
        />
        <StatCard
          label="Days"
          value={stats.daysTracked}
          icon={<Calendar className="w-3.5 h-3.5 text-emerald-500" />}
          gradient="from-emerald-50 to-teal-50"
          border="border-emerald-100"
        />
      </div>

      {/* ============ Weekly Activity ============ */}
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-500" />
          Last 7 Days Activity
        </h4>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dailyData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <Bar dataKey="events" name="Events" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ============ Event Distribution (Donut Chart) ============ */}
      <div className="bg-white border border-gray-100 rounded-xl p-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-purple-500" />
          Event Distribution
        </h4>
        <div className="flex items-center">
          <div className="w-28 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={50}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 ml-3 space-y-1">
            {stats.pieData.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600 truncate flex-1">{entry.name}</span>
                <span className="font-bold text-gray-800">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ Event Timeline (Area Chart) ============ */}
      {stats.timelineData.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            Event Timeline
          </h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                />
                <Tooltip content={<CustomTooltip />} />
                <defs>
                  <linearGradient id="symptomGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="otherGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="symptoms"
                  name="Symptoms"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="url(#symptomGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="medications"
                  name="Medications"
                  stackId="1"
                  stroke="#10b981"
                  fill="url(#medGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="other"
                  name="Other"
                  stackId="1"
                  stroke="#6366f1"
                  fill="url(#otherGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <LegendItem color="#f59e0b" label="Symptoms" />
            <LegendItem color="#10b981" label="Medications" />
            <LegendItem color="#6366f1" label="Other" />
          </div>
        </div>
      )}

      {/* ============ Severity Breakdown ============ */}
      {stats.severityData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
            Severity Breakdown
          </h4>
          <div className="space-y-2">
            {stats.severityData.map((item, i) => {
              const maxVal = Math.max(...stats.severityData.map(d => d.value))
              const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500 w-14">{item.name}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-6 text-right">{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ============ Top Insight ============ */}
      {stats.topType && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Most Common</p>
              <p className="text-xs font-bold text-indigo-700">
                {stats.topType.type} ({stats.topType.count}x)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================
// Sub-Components
// ============================================
function StatCard({ label, value, icon, gradient, border }) {
  return (
    <div className={`bg-gradient-to-br ${gradient} border ${border} rounded-xl p-2.5 text-center`}>
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-lg font-extrabold text-gray-800 leading-none">{value}</p>
      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{label}</p>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
    </div>
  )
}
