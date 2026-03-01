import React, { useState, useRef, useEffect } from 'react'
import {
  Send, ImagePlus, X, Pill, Newspaper, Camera, TrendingUp,
  RotateCcw, AlertTriangle, Mic, MicOff,
  Shield, Sparkles, Copy, Check, ChevronDown, Search, Zap,
  Stethoscope, Brain, ArrowDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { sendMessage, sendMessageStream, sendImageMessage, clearConversations, createProfile, getConversations } from '../api/client'

const QUICK_DEMOS = [
  {
    icon: Pill,
    label: 'Side Effect Check',
    description: 'Understand medication symptoms',
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    message: "I started my blood pressure medication (Lisinopril) about 3 days ago and I've been having a persistent dry cough. Is this something I should worry about?",
  },
  {
    icon: Newspaper,
    label: 'Scary Article',
    description: 'Make sense of health news',
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
    message: "I just read online that Metformin can cause lactic acidosis and it sounds really dangerous. I've been taking it for my diabetes. Should I stop taking it? I'm really worried now.",
  },
  {
    icon: Camera,
    label: 'Skin Analysis',
    description: 'Get visual health guidance',
    gradient: 'from-blue-500 to-indigo-600',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    message: "I noticed a new spot on my arm that wasn't there before. It's small, dark, and slightly raised. I'm uploading a photo - can you help me understand what I should watch for?",
  },
  {
    icon: TrendingUp,
    label: 'Find Patterns',
    description: 'Discover health trends',
    gradient: 'from-purple-500 to-violet-600',
    bgLight: 'bg-purple-50',
    borderColor: 'border-purple-200',
    message: "Can you analyze my health timeline and tell me if you notice any patterns in my symptoms? I feel like my headaches might be connected to something but I can't figure out what.",
  },
]

const URGENCY_BADGES = {
  reassurance: { label: 'Reassurance', icon: '✅', className: 'urgency-reassurance' },
  monitor: { label: 'Monitor', icon: '⚠️', className: 'urgency-monitor' },
  see_doctor: { label: 'See Doctor', icon: '🏥', className: 'urgency-see_doctor' },
  urgent: { label: 'Urgent', icon: '🚨', className: 'urgency-urgent' },
}

const TOOL_LABELS = {
  get_health_profile: { label: 'Reading health profile', icon: Search },
  search_health_timeline: { label: 'Searching timeline', icon: Search },
  log_health_event: { label: 'Logging health event', icon: Zap },
  analyze_health_patterns: { label: 'Analyzing patterns', icon: Brain },
  update_health_profile: { label: 'Updating profile', icon: Stethoscope },
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `Hey there! 👋 I'm **MedAlly**, your personal AI health companion.

I help you understand your health between doctor visits — **without replacing your doctor**.

Here's what I can do:

- 💊 **Check Side Effects** — Understand if symptoms are related to your medications
- 🛡️ **Filter Medical Noise** — Contextualize scary health articles for YOUR situation
- 📸 **Analyze Skin Concerns** — Get non-diagnostic visual guidance
- 📊 **Discover Patterns** — Find trends in your health timeline

**To get started**, set up your Health Profile in the sidebar, then ask me anything!

> *I'm not a doctor — I help you have better conversations with yours.*`,
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
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [activeToolCall, setActiveToolCall] = useState(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
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
      recognition.lang = 'en-IN'

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
        setInput(finalTranscript + interim)
      }

      recognition.onend = () => {
        setIsRecording(false)
        if (finalTranscript.trim()) {
          const text = finalTranscript.trim()
          finalTranscript = ''
          setInput('')
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
        recognitionRef.current.stop()
        setTimeout(() => recognitionRef.current.start(), 100)
      }
    }
  }

  // Load stored conversation history on mount / patient change
  useEffect(() => {
    if (!patientId) return
    async function loadHistory() {
      try {
        const data = await getConversations(patientId)
        const stored = data.messages || []
        if (stored.length > 0) {
          const loaded = stored.map(m => ({
            role: m.role,
            content: m.content,
            urgency_level: m.urgency_level || null,
            hasImage: m.has_image || false,
          }))
          setMessages([WELCOME_MESSAGE, ...loaded])
        }
      } catch (err) {
        console.error('Failed to load chat history:', err)
      }
    }
    loadHistory()
  }, [patientId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
    }
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

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

    const msgContent = text || (selectedImage ? 'Please analyze this skin image.' : '')
    const userMsg = { role: 'user', content: msgContent, hasImage: !!selectedImage }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setError(null)
    setIsLoading(true)
    setActiveToolCall(null)

    try {
      const history = messages.filter(m => m !== WELCOME_MESSAGE).map(m => ({
        role: m.role,
        content: m.content,
      }))

      if (selectedImage) {
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
        setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

        await sendMessageStream(patientId, text, history, (chunk) => {
          if (chunk.type === 'text') {
            setActiveToolCall(null)
            setMessages(prev => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.role === 'assistant') {
                updated[updated.length - 1] = { ...lastMsg, content: chunk.fullText }
              }
              return updated
            })
          } else if (chunk.type === 'tool_call') {
            const toolInfo = TOOL_LABELS[chunk.name] || { label: chunk.name.replace(/_/g, ' '), icon: Search }
            setActiveToolCall(toolInfo)
          } else if (chunk.type === 'done') {
            setActiveToolCall(null)
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
            onNewTimelineEvents?.()
          }
        })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err.message)
      setActiveToolCall(null)
      setMessages(prev => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isStreaming) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            isError: true,
          }
        } else {
          updated.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again.',
            isError: true,
          })
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      setActiveToolCall(null)
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
      const newProfile = await createProfile()
      const newId = newProfile.patient_id
      localStorage.setItem('health_companion_patient_id', newId)
      setMessages([WELCOME_MESSAGE])
      setError(null)
      onNewSession?.(newId)
    } catch (err) {
      console.error('New session error:', err)
      setError('Failed to start new session. Please try again.')
    }
  }

  const isWelcomeOnly = messages.length <= 1

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* ============ Reset Confirmation Modal ============ */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 msg-animate-fade">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Start New Session?</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              This will create a <strong>completely new patient session</strong>:
            </p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
              {['All conversation history', 'Health profile data', 'Health timeline events', 'Uploaded images'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleNewSession}
                className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-sm shadow-red-200"
              >
                Yes, Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Messages Area ============ */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} />
          ))}

          {/* Tool Call Indicator */}
          {activeToolCall && (
            <div className="flex gap-3 msg-animate-fade">
              <div className="w-8 h-8 rounded-xl ai-avatar flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="tool-shimmer rounded-2xl rounded-tl-md px-4 py-3 border border-indigo-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <activeToolCall.icon className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span className="text-sm text-indigo-600 font-medium">{activeToolCall.label}...</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator (when no streaming and no tool call) */}
          {isLoading && !messages.some(m => m.isStreaming) && !activeToolCall && (
            <div className="flex gap-3 msg-animate-fade">
              <div className="w-8 h-8 rounded-xl ai-avatar flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full loading-dot" />
                  <div className="w-2 h-2 bg-blue-400 rounded-full loading-dot" />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full loading-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-36 right-6 w-9 h-9 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-all bounce-down z-20"
        >
          <ArrowDown className="w-4 h-4 text-gray-500" />
        </button>
      )}

      {/* ============ Quick Demo Cards ============ */}
      {isWelcomeOnly && (
        <div className="px-4 pb-3">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-semibold text-gray-400 mb-2.5 ml-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Try a Quick Demo
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUICK_DEMOS.map((demo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(demo.message)}
                  disabled={isLoading}
                  className={`demo-card feature-card-animate flex flex-col items-center gap-2 p-4 rounded-xl border ${demo.borderColor} ${demo.bgLight} text-center group disabled:opacity-50`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${demo.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <demo.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">{demo.label}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{demo.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ Image Preview ============ */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 msg-animate-fade">
              <img src={imagePreview} alt="Preview" className="w-14 h-14 object-cover rounded-lg shadow-sm" />
              <div>
                <span className="text-sm font-medium text-blue-700">Image attached</span>
                <span className="text-xs text-blue-400 block">Ready for analysis</span>
              </div>
              <button onClick={removeImage} className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors ml-1">
                <X className="w-4 h-4 text-blue-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Error Banner ============ */}
      {error && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 msg-animate-fade">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Recording Indicator ============ */}
      {isRecording && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 msg-animate-fade">
              <div className="flex items-center gap-0.5 h-5">
                {[...Array(5)].map((_, i) => <div key={i} className="wave-bar" />)}
              </div>
              <span className="text-sm text-red-700 font-semibold">Listening...</span>
              <span className="text-xs text-red-400">Click mic to stop & send</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ Input Area ============ */}
      <div className="input-bar bg-white border-t border-gray-100 px-4 py-3">
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
              className="p-2.5 rounded-xl hover:bg-indigo-50 transition-all text-gray-400 hover:text-indigo-500 disabled:opacity-50 active:scale-95"
              title="Upload skin image"
            >
              <ImagePlus className="w-5 h-5" />
            </button>

            {/* Voice Input */}
            {speechSupported && (
              <button
                onClick={toggleRecording}
                disabled={isLoading}
                className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200'
                    : 'hover:bg-indigo-50 text-gray-400 hover:text-indigo-500'
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
                placeholder={isRecording ? 'Listening... speak now' : 'Ask MedAlly anything about your health...'}
                rows={1}
                disabled={isLoading}
                readOnly={isRecording}
                className={`w-full resize-none rounded-xl border px-4 py-2.5 pr-4 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 max-h-32 transition-all ${
                  isRecording
                    ? 'border-red-300 bg-red-50 focus:ring-red-400'
                    : 'border-gray-200 bg-gray-50 focus:ring-indigo-400 hover:border-gray-300'
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
              className="p-2.5 rounded-xl btn-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>

            {/* New Session */}
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isLoading || isRecording}
              className="p-2.5 rounded-xl hover:bg-red-50 transition-all text-gray-400 hover:text-red-500 disabled:opacity-50 active:scale-95"
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


// ============================================
// Message Bubble Component
// ============================================
function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const urgency = message.urgency_level ? URGENCY_BADGES[message.urgency_level] : null
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) { /* ignore */ }
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''} ${isUser ? 'msg-animate-right' : 'msg-animate-left'}`}>
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl ai-avatar flex items-center justify-center shrink-0 mt-1">
          <Shield className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Urgency Badge */}
        {urgency && (
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border mb-1.5 ${urgency.className} ${message.urgency_level === 'urgent' ? 'urgency-pulse-urgent' : ''}`}>
            <span>{urgency.icon}</span>
            <span>{urgency.label}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-md shadow-sm shadow-indigo-200'
              : message.isError
              ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-md'
              : 'bg-white shadow-sm border border-gray-100/80 rounded-tl-md'
          }`}
        >
          {isUser ? (
            <div className="text-sm whitespace-pre-wrap">
              {message.hasImage && (
                <span className="inline-flex items-center gap-1 text-blue-200 text-xs mb-1 bg-white/10 px-2 py-0.5 rounded-full">
                  <Camera className="w-3 h-3" /> Image attached
                </span>
              )}
              {message.content}
            </div>
          ) : (
            <div className={`chat-markdown text-sm ${message.isStreaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Action Buttons for assistant messages */}
        {!isUser && !message.isError && message.content && !message.isStreaming && (
          <div className="flex items-center gap-3 mt-1.5 ml-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-indigo-500 transition-colors"
              title="Copy response"
            >
              {copied ? (
                <><Check className="w-3.5 h-3.5 text-emerald-500 copy-check-animate" /><span className="text-emerald-500">Copied!</span></>
              ) : (
                <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center shrink-0 mt-1">
          <span className="text-sm font-bold text-gray-600">
            {/* Show first initial if profile has name */}
            U
          </span>
        </div>
      )}
    </div>
  )
}
