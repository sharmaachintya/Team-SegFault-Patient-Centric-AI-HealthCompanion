import React, { useState, useEffect } from 'react'
import { Heart, Menu, X, MessageSquare, User, Clock, Activity, Shield, Sparkles, BarChart3 } from 'lucide-react'
import ChatPanel from './components/ChatPanel'
import HealthProfile from './components/HealthProfile'
import Timeline from './components/Timeline'
import HealthInsights from './components/HealthInsights'
import { createProfile, getProfile, getTimeline } from './api/client'

const PATIENT_ID_KEY = 'health_companion_patient_id'

function MedAllyLogo({ size = 'md', white = false }) {
  const sizes = {
    sm: { icon: 'w-5 h-5', text: 'text-sm', sub: 'text-[9px]' },
    md: { icon: 'w-7 h-7', text: 'text-lg', sub: 'text-[10px]' },
    lg: { icon: 'w-10 h-10', text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 'w-14 h-14', text: 'text-4xl', sub: 'text-sm' },
  }
  const s = sizes[size]
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${s.icon} rounded-xl bg-gradient-to-br from-indigo-500 via-blue-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-200/50`}>
        <Shield className={`${size === 'xl' ? 'w-7 h-7' : size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'} text-white`} />
      </div>
      <div className="leading-none">
        <h1 className={`${s.text} font-extrabold tracking-tight ${white ? 'text-white' : 'bg-gradient-to-r from-indigo-700 via-blue-600 to-emerald-500 bg-clip-text text-transparent'}`}>
          Med<span className={white ? 'text-blue-200' : ''}>Ally</span>
        </h1>
        <p className={`${s.sub} ${white ? 'text-indigo-200' : 'text-gray-400'} font-medium tracking-wide`}>
          AI Health Companion
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [patientId, setPatientId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [activeTab, setActiveTab] = useState('profile')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initPatient()
  }, [])

  async function initPatient() {
    try {
      // Check for demo mode via URL parameter (?demo=true)
      const urlParams = new URLSearchParams(window.location.search)
      const isDemo = urlParams.get('demo') === 'true'

      let id = isDemo ? 'demo0001' : localStorage.getItem(PATIENT_ID_KEY)
      if (!id) {
        const newProfile = await createProfile()
        id = newProfile.patient_id
      }
      localStorage.setItem(PATIENT_ID_KEY, id)
      setPatientId(id)
      await refreshData(id)
    } catch (err) {
      console.error('Init error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function refreshData(id) {
    const pid = id || patientId
    if (!pid) return
    try {
      const [profileData, timelineData] = await Promise.all([
        getProfile(pid),
        getTimeline(pid),
      ])
      setProfile(profileData)
      setTimeline(timelineData.events || [])
    } catch (err) {
      console.error('Refresh error:', err)
    }
  }

  function handleProfileUpdate(newProfile) {
    setProfile(newProfile)
  }

  function handleNewTimelineEvents() {
    refreshData()
  }

  async function handleNewSession(newId) {
    setPatientId(newId)
    setProfile(null)
    setTimeline([])
    await refreshData(newId)
  }

  // ==========================================
  // Splash / Loading Screen
  // ==========================================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-200/10 rounded-full blur-3xl" />
        </div>

        <div className="text-center relative z-10">
          {/* Animated icon */}
          <div className="relative mb-8 splash-fade-in">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-500 to-emerald-400 flex items-center justify-center shadow-2xl shadow-indigo-300/50 splash-icon-pulse">
              <Shield className="w-12 h-12 text-white" />
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-3xl border-2 border-indigo-300/30 splash-ring" />
          </div>

          {/* Brand */}
          <div className="splash-fade-in-delay">
            <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-700 via-blue-600 to-emerald-500 bg-clip-text text-transparent">
              MedAlly
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide">
              Your AI Health Companion
            </p>
          </div>

          {/* Loading indicator */}
          <div className="mt-10 splash-fade-in-delay-2">
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 bg-indigo-400 rounded-full loading-dot" />
              <div className="w-2 h-2 bg-blue-400 rounded-full loading-dot" />
              <div className="w-2 h-2 bg-emerald-400 rounded-full loading-dot" />
            </div>
            <p className="text-gray-400 text-xs mt-3">Preparing your health assistant...</p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // Main App Layout
  // ==========================================
  return (
    <div className="flex h-screen bg-mesh-gradient overflow-hidden">
      {/* ============ Sidebar ============ */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 ease-in-out bg-white border-r border-gray-100 flex flex-col overflow-hidden shadow-sm`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-500">
          <MedAllyLogo size="md" white />
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-2 text-xs font-semibold flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'profile'
                ? 'tab-active'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 px-2 text-xs font-semibold flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'timeline'
                ? 'tab-active'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Timeline
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`flex-1 py-3 px-2 text-xs font-semibold flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'insights'
                ? 'tab-active'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Insights
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' && (
            <HealthProfile
              patientId={patientId}
              profile={profile}
              onUpdate={handleProfileUpdate}
            />
          )}
          {activeTab === 'timeline' && (
            <Timeline
              patientId={patientId}
              events={timeline}
              onRefresh={() => refreshData()}
            />
          )}
          {activeTab === 'insights' && (
            <HealthInsights
              events={timeline}
              profile={profile}
            />
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
              <Activity className="w-3 h-3 text-indigo-500" />
            </div>
            <span className="font-mono">ID: {patientId}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
            <Shield className="w-3 h-3 text-gray-300" />
            Not a medical device. Always consult your doctor.
          </p>
        </div>
      </aside>

      {/* ============ Main Content ============ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 glass-strong border-b border-gray-100 flex items-center px-4 gap-3 shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-all duration-200 active:scale-95"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-gray-400" /> : <Menu className="w-5 h-5 text-gray-400" />}
          </button>

          {!sidebarOpen && <MedAllyLogo size="sm" />}

          <div className="flex items-center gap-2 ml-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="font-bold text-gray-700 text-sm">Health Chat</h2>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600">AI Ready</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </header>

        {/* Chat Panel */}
        <ChatPanel
          patientId={patientId}
          profile={profile}
          onNewTimelineEvents={handleNewTimelineEvents}
          onNewSession={handleNewSession}
        />
      </main>
    </div>
  )
}
