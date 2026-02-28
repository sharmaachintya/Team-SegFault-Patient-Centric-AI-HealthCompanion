import React, { useState, useRef, useEffect } from 'react'
import { Send, ImagePlus, X, Pill, Newspaper, Camera, TrendingUp, RotateCcw, AlertTriangle, Mic, MicOff, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { sendMessage, sendMessageStream, sendImageMessage, clearConversations, createProfile } from '../api/client'

const QUICK_DEMOS = [
  {
    icon: Pill,
    label: 'Side Effect Check',
    color: 'emerald',
    message: "I started my blood pressure medication (Lisinopril) about 3 days ago and I've been having a persistent dry cough. Is this something I should worry about?",
  },
  {
    icon: Newspaper,
    label: 'Scary Article',
    color: 'amber',
    message: "I just read online that Metformin can cause lactic acidosis and it sounds really dangerous. I've been taking it for my diabetes. Should I stop taking it? I'm really worried now.",
  },
  {
    icon: Camera,
    label: 'Skin Analysis',
    color: 'blue',
    message: "I noticed a new spot on my arm that wasn't there before. It's small, dark, and slightly raised. I'm uploading a photo - can you help me understand what I should watch for?",
  },
  {
    icon: TrendingUp,
    label: 'Find Patterns',
    color: 'purple',
    message: "Can you analyze my health timeline and tell me if you notice any patterns in my symptoms? I feel like my headaches might be connected to something but I can't figure out what.",
  },
]

const URGENCY_BADGES = {
  reassurance: { label: '✅ Reassurance', className: 'urgency-reassurance' },
  monitor: { label: '⚠️ Monitor', className: 'urgency-monitor' },
  see_doctor: { label: '🏥 See Doctor', className: 'urgency-see_doctor' },
  urgent: { label: '🚨 Urgent', className: 'urgency-urgent' },
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `👋 **Welcome to AI Health Companion!**

I'm your personal health assistant, here to help you understand your health between doctor visits.

**Here's what I can help you with:**
- 💊 **Side Effect Checker** — Understand symptoms related to your medications
- 🛡️ **Medical Info Filter** — Make sense of scary health articles or statistics
- 📸 **Skin Analysis** — Get non-diagnostic guidance on skin concerns
- 📊 **Pattern Discovery** — Find trends in your health timeline

**Get started:**
1. Set up your **Health Profile** in the sidebar (medications, conditions, allergies)
2. Ask me anything, or try a **Quick Demo** below!

> ⚕️ *I'm not a doctor. I provide guidance to help you have better conversations with your healthcare provider.*`,
}

export default function ChatPanel({ patientId, profile, onNewTimelineEvents, onNewSession }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [error, setError] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  // Check browser speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSpeechSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-IN' // English (India) - supports Indian accent

      let finalTranscript = ''

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interim = transcript
          }
        }
        // Show real-time transcription in the input
        setInput(finalTranscript + interim)
      }

      recognition.onend = () => {
        setIsRecording(false)
        // Auto-send if there's transcribed text
        if (finalTranscript.trim()) {
          const text = finalTranscript.trim()
          finalTranscript = ''
          setInput('')
          // Small delay to let state update
          setTimeout(() => handleSend(text), 100)
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access in your browser settings.')
        }
      }

      recognitionRef.current = recognition
    }
  }, [])

  function toggleRecording() {
    if (!recognitionRef.current) return

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      setInput('')
      setIsRecording(true)
      try {
        recognitionRef.current.start()
      } catch (e) {
        // May already be running
        recognitionRef.current.stop()
        setTimeout(() => {
          recognitionRef.current.start()
        }, 100)
      }
    }
  }

  // TTS: Read AI response aloud
  function speakText(text) {
    if (!window.speechSynthesis) return
    // Strip markdown for cleaner speech
    const clean = text.replace(/[#*_`>\[\]()!~|]/g, '').replace(/\n+/g, '. ')
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.lang = 'en-IN'
    window.speechSynthesis.cancel() // Stop any ongoing speech
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleImageSelect(e) {
    const file = e.target.files[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  function removeImage() {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSend(messageText) {
    const text = messageText || input.trim()
    if (!text && !selectedImage) return
    if (!patientId) return

    // Ensure content is never empty (especially for image uploads)
    const msgContent = text || (selectedImage ? 'Please analyze this skin image.' : '')
    const userMsg = { role: 'user', content: msgContent, hasImage: !!selectedImage }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const history = messages.filter(m => m !== WELCOME_MESSAGE).map(m => ({
        role: m.role,
        content: m.content,
      }))

      if (selectedImage) {
        // Image messages use non-streaming endpoint
        const result = await sendImageMessage(patientId, text || 'Please analyze this image.', selectedImage)
        removeImage()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.response,
          urgency_level: result.urgency_level,
        }])
        if (result.new_timeline_events?.length > 0) {
          onNewTimelineEvents?.()
        }
      } else {
        // Text messages use streaming
        // Add a placeholder assistant message that we'll update
        const streamMsgIndex = messages.length + 1 // +1 for the user msg we just added
        setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

        await sendMessageStream(patientId, text, history, (chunk) => {
          if (chunk.type === 'text') {
            // Update the streaming message with accumulated text
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: chunk.fullText,
                }
              }
              return updated
            })
          } else if (chunk.type === 'tool_call') {
            // Show tool call indicator briefly
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: `🔧 *Analyzing with ${chunk.name.replace(/_/g, ' ')}...*`,
                }
              }
              return updated
            })
          } else if (chunk.type === 'done') {
            // Finalize the message
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...lastMsg,
                  content: chunk.fullText,
                  urgency_level: chunk.urgencyLevel,
                  isStreaming: false,
                }
              }
              return updated
            })
            // Always refresh profile & timeline (AI may have auto-updated profile)
            onNewTimelineEvents?.()
          }
        })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err.message)
      // Replace streaming message with error, or add error
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '❌ Sorry, I encountered an error processing your request. Please try again.',
            isError: true,
          }
        } else {
          updated.push({
            role: 'assistant',
            content: '❌ Sorry, I encountered an error processing your request. Please try again.',
            isError: true,
          })
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleNewSession() {
    setShowResetConfirm(false)
    try {
      // Create a brand new patient profile
      const newProfile = await createProfile()
      const newId = newProfile.patient_id
      localStorage.setItem('health_companion_patient_id', newId)
      setMessages([WELCOME_MESSAGE])
      setError(null)
      // Notify parent to reload everything with new patient
      onNewSession?.(newId)
    } catch (err) {
      console.error('New session error:', err)
      setError('Failed to start new session. Please try again.')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* New Session Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Start New Session?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              This will create a <strong>completely new patient session</strong>. The following will be permanently reset:
            </p>
            <ul className="text-sm text-gray-600 mb-4 ml-4 list-disc space-y-1">
              <li>All conversation history</li>
              <li>Health profile (medications, conditions, allergies)</li>
              <li>Health timeline events</li>
              <li>Uploaded images</li>
            </ul>
            <p className="text-xs text-gray-500 mb-5 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ Your previous session data will remain stored but will no longer be accessible from this browser.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewSession}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, Start New Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} onSpeak={speakText} />
          ))}

          {isLoading && !messages.some(m => m.isStreaming) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-sm">🤖</span>
              </div>
              <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-blue-400 rounded-full loading-dot" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full loading-dot" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full loading-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Demo Buttons */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-medium text-gray-500 mb-2 ml-1">⚡ Quick Demos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_DEMOS.map((demo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(demo.message)}
                  disabled={isLoading}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-${demo.color}-300 hover:bg-${demo.color}-50 transition-all text-center group disabled:opacity-50`}
                >
                  <demo.icon className={`w-5 h-5 text-${demo.color}-500 group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-gray-700">{demo.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
              <span className="text-sm text-blue-700">Image attached</span>
              <button onClick={removeImage} className="p-1 hover:bg-blue-100 rounded">
                <X className="w-4 h-4 text-blue-500" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="px-4 pb-1">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-700 font-medium">Listening...</span>
              <span className="text-xs text-red-500 ml-1">Speak clearly, click mic again to stop & send</span>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            {/* Image Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isRecording}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500 disabled:opacity-50"
              title="Upload skin image for analysis"
            >
              <ImagePlus className="w-5 h-5" />
            </button>

            {/* Voice Input */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={isLoading}
                className={`p-2.5 rounded-xl transition-all ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 animate-pulse'
                    : 'hover:bg-gray-100 text-gray-400 hover:text-blue-500'
                } disabled:opacity-50`}
                title={isRecording ? 'Stop recording & send' : 'Voice input'}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? '🎤 Listening... speak now' : 'Type or use voice input...'}
                rows={1}
                disabled={isLoading}
                readOnly={isRecording}
                className={`w-full resize-none rounded-xl border px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 max-h-32 ${
                  isRecording
                    ? 'border-red-300 bg-red-50 focus:ring-red-500'
                    : 'border-gray-300 bg-gray-50 focus:ring-blue-500'
                }`}
                style={{ minHeight: '42px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={() => handleSend()}
              disabled={isLoading || isRecording || (!input.trim() && !selectedImage)}
              className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>

            {/* New Session */}
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isLoading || isRecording}
              className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
              title="Start new session"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


function MessageBubble({ message, onSpeak }) {
  const isUser = message.role === 'user'
  const urgency = message.urgency_level ? URGENCY_BADGES[message.urgency_level] : null

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
          <span className="text-sm">🤖</span>
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {urgency && (
          <div className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-1 ${urgency.className}`}>
            {urgency.label}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-md'
              : message.isError
              ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-md'
              : 'bg-white shadow-sm border border-gray-100 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <div className="text-sm whitespace-pre-wrap">
              {message.hasImage && <span className="block text-blue-200 text-xs mb-1">📷 Image attached</span>}
              {message.content}
            </div>
          ) : (
            <div className="chat-markdown text-sm">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {/* Read Aloud button for assistant messages */}
        {!isUser && !message.isError && message.content && !message.isStreaming && (
          <button
            onClick={() => onSpeak?.(message.content)}
            className="mt-1 ml-1 flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors"
            title="Read aloud"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Listen</span>
          </button>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
          <span className="text-sm">👤</span>
        </div>
      )}
    </div>
  )
}
