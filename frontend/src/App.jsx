import React, { useState, useEffect } from 'react'
import { Heart, Menu, X, MessageSquare, User, Clock, Activity } from 'lucide-react'
import ChatPanel from './components/ChatPanel'
import HealthProfile from './components/HealthProfile'
import Timeline from './components/Timeline'
import { createProfile, getProfile, getTimeline } from './api/client'

const PATIENT_ID_KEY = 'health_companion_patient_id'

export default function App() {
  const [patientId, setPatientId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [activeTab, setActiveTab] = useState('chat') // chat, profile, timeline
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  // Initialize patient
  useEffect(() => {
    initPatient()
  }, [])

  async function initPatient() {
    try {
      let id = localStorage.getItem(PATIENT_ID_KEY)
      if (!id) {
        const newProfile = await createProfile()
        id = newProfile.patient_id
        localStorage.setItem(PATIENT_ID_KEY, id)
      }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-12 h-12 text-blue-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">AI Health Companion</h1>
          <p className="text-gray-500 mt-2">Loading your health assistant...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">AI Health</h1>
              <p className="text-blue-100 text-xs">Companion</p>
            </div>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 px-2 text-xs font-medium flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'timeline'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            Timeline
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
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Activity className="w-3 h-3" />
            <span>ID: {patientId}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            ⚕️ Not a medical device. Always consult your doctor.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-gray-500" /> : <Menu className="w-5 h-5 text-gray-500" />}
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">Health Chat</h2>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500">AI Ready</span>
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
