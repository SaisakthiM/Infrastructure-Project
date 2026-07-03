import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { useWebSocket } from '../hooks/useWebSocket'
// NEW: Added authAPI to the import so we can search for users
import { roomAPI, mediaAPI, messageAPI, authAPI } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

export default function ChatView({ roomId, roomName }) {
  const { user, token } = useAuthStore()
  const { messages: liveMessages, isConnected, error: wsError, sendMessage, sendImage, clearMessages } = useWebSocket(roomId, token)
  
  const [history, setHistory] = useState([])
  const [messageText, setMessageText] = useState('')
  const [members, setMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  
  // NEW: State for adding members
  const [showAddMember, setShowAddMember] = useState(false)
  const [addSearchTerm, setAddSearchTerm] = useState('')
  const [addSearchResults, setAddSearchResults] = useState([])
  
  const messagesContainerRef = useRef(null)
  const fileInputRef = useRef(null)

  // Fetch History & Members
  useEffect(() => {
    if (!roomId || !user?.id) return;
    
    setHistory([])
    clearMessages()

    const loadData = async () => {
      try {
        const [memberData, msgData] = await Promise.all([
          roomAPI.getRoomMembers(roomId),
          messageAPI.getMessages(roomId, user.id)
        ])
        setMembers(memberData || [])
        setHistory(msgData || [])
      } catch (error) {
        console.error('Failed to load room data:', error)
      }
    }
    loadData()
  }, [roomId, user?.id])

  // NEW: Search effect for adding members
  useEffect(() => {
    const search = async () => {
      if (addSearchTerm.length >= 2) {
        try {
          const results = await authAPI.searchUsers(addSearchTerm)
          // Filter out users who are already in the room
          const existingIds = new Set(members.map(m => m.user_id))
          setAddSearchResults(results.filter(u => !existingIds.has(u.id)))
        } catch (error) {
          console.error("Search failed:", error)
        }
      } else {
        setAddSearchResults([])
      }
    }
    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [addSearchTerm, members])

  // NEW: Handler to add the selected member
  const handleAddMember = async (targetUser) => {
    try {
      await roomAPI.joinRoom(roomId, targetUser.id)
      // Refresh the members list so they show up immediately
      const updatedMembers = await roomAPI.getRoomMembers(roomId)
      setMembers(updatedMembers || [])
      setShowAddMember(false)
      setAddSearchTerm('')
    } catch (err) {
      alert("Failed to add member to the group.")
    }
  }

  // Combine History + Live (deduplicating by ID)
  const allMessages = useMemo(() => {
    return [...history, ...liveMessages.filter(lm => !history.some(hm => hm.id === lm.id))]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }, [history, liveMessages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [allMessages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (messageText.trim() && isConnected) {
      sendMessage(messageText)
      setMessageText('')
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Only image files are supported')

    try {
      setUploadProgress(0)
      const result = await mediaAPI.uploadImage(file, setUploadProgress)
      sendImage(result.url, '')
    } catch (err) {
      alert('Failed to upload image')
    } finally {
      setUploadProgress(null)
      e.target.value = ''
    }
  }

  const isCurrentUserMessage = (senderId) => senderId === user?.id
  const connectionLabel = isConnected ? 'Online' : (wsError === 'Reconnecting...' ? 'Reconnecting…' : 'Connecting…')

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative z-10 min-w-0 bg-aurora-glass backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-aurora-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aurora-violet to-aurora-teal flex items-center justify-center font-bold text-aurora-900 shrink-0">
              {roomName?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{roomName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`relative inline-flex w-2 h-2 rounded-full ${isConnected ? 'bg-aurora-mint' : 'bg-aurora-amber'}`} />
                <p className="text-xs text-white/50">{connectionLabel}</p>
              </div>
            </div>
          </div>
          
          {/* NEW: Added wrapper div to hold both header buttons together */}
          <div className="flex items-center gap-2">
            {/* NEW: Add Member Button */}
            <button 
              onClick={() => setShowAddMember(true)} 
              className="icon-btn text-white/70 hover:text-white"
              title="Add Member"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>

            {/* Existing Show Members Button */}
            <button onClick={() => setShowMembers(!showMembers)} className="icon-btn text-white/70 hover:text-white" title="View Members">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col chat-bg min-w-0 min-h-0">
          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col min-h-0">
            {allMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isCurrentUserMessage(msg.sender_id) ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`message-bubble ${isCurrentUserMessage(msg.sender_id) ? 'message-sent' : 'message-received'} ${msg.message_type === 'image' ? 'p-1.5' : ''}`}>
                  {msg.message_type === 'image' && msg.media_url ? (
                    <div className="space-y-1">
                      <img
                        src={mediaAPI.resolveUrl(msg.media_url)}
                        alt="shared media"
                        className="rounded-xl max-h-72 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewImage(mediaAPI.resolveUrl(msg.media_url))}
                        loading="lazy"
                      />
                      {msg.content && <p className="break-words px-1.5">{msg.content}</p>}
                    </div>
                  ) : (
                    <p className="break-words">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-1 text-right ${isCurrentUserMessage(msg.sender_id) ? 'text-aurora-900/60' : 'text-white/40'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <AnimatePresence>
            {uploadProgress !== null && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="px-4 pb-2">
                <div className="glass rounded-full h-2 overflow-hidden">
                  <motion.div className="h-full bg-btn-gradient" animate={{ width: `${uploadProgress}%` }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-4 bg-aurora-glass border-t border-aurora-border flex gap-3 items-center">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!isConnected} className="icon-btn text-white/70 hover:text-aurora-teal">
              📎
            </button>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              disabled={!isConnected}
              className="input-field flex-1 rounded-full"
            />
            <button type="submit" disabled={!isConnected || !messageText.trim()} className="bg-btn-gradient text-aurora-900 p-3 rounded-full font-bold">
              Send
            </button>
          </form>
        </div>

        <AnimatePresence>
          {showMembers && (
            <motion.div initial={{ width: 0 }} animate={{ width: 288 }} exit={{ width: 0 }} className="border-l border-aurora-border glass flex flex-col shrink-0">
              <div className="p-4 border-b border-aurora-border w-72"><h3 className="font-semibold text-white">Members</h3></div>
              <div className="flex-1 overflow-y-auto w-72">
                {members.map(member => (
                  <div key={member.user_id} className="p-4 border-b border-aurora-border hover:bg-white/5">
                    <p className="font-medium text-white text-sm">{member.username}</p>
                    <p className="text-xs text-white/40 mt-1">Last seen {formatDistanceToNow(new Date(member.last_seen_at), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* NEW: Add Member Modal (Inserted just above Image Preview) */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setShowAddMember(false)} 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: 20, scale: 0.95 }} 
              animate={{ y: 0, scale: 1 }} 
              exit={{ y: 20, scale: 0.95 }} 
              onClick={e => e.stopPropagation()} 
              className="glass-card w-full max-w-sm p-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Add Member to Group</h3>
              
              <input
                type="text"
                autoFocus
                placeholder="Search by username..."
                value={addSearchTerm}
                onChange={(e) => setAddSearchTerm(e.target.value)}
                className="input-field mb-4 text-sm"
              />
              
              <div className="max-h-60 overflow-y-auto min-h-[100px]">
                {addSearchTerm.length < 2 ? (
                  <p className="text-white/40 text-sm text-center mt-4">Type at least 2 characters to search...</p>
                ) : addSearchResults.length === 0 ? (
                  <p className="text-white/40 text-sm text-center mt-4">No users found, or they are already in the room.</p>
                ) : (
                  addSearchResults.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleAddMember(u)}
                      className="p-3 border-b border-aurora-border/50 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors last:border-0 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0">
                        {u.profile_photo_url ? (
                          <img src={mediaAPI.resolveUrl(u.profile_photo_url)} className="w-full h-full object-cover" />
                        ) : (
                          u.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{u.username}</p>
                        <p className="text-xs text-white/40 mt-0.5">Click to add</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <button 
                onClick={() => setShowAddMember(false)} 
                className="btn-secondary w-full mt-4"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewImage && (
          <motion.div onClick={() => setPreviewImage(null)} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center cursor-zoom-out">
            <img src={previewImage} alt="preview" className="max-h-[85vh] max-w-[90vw] rounded-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}