import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { roomAPI, authAPI, mediaAPI } from '../services/api'
import { formatDistanceToNow } from 'date-fns'

function avatarGradient(seed) {
  const gradients = ['from-aurora-mint to-aurora-teal', 'from-aurora-violet to-aurora-pink', 'from-aurora-amber to-aurora-pink']
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % gradients.length
  return gradients[Math.abs(hash)]
}

export default function ChatList({ selectedRoomId, onRoomSelect, onLogout }) {
  const { user, logout } = useAuthStore()
  const [rooms, setRooms] = useState([])
  const [globalUsers, setGlobalUsers] = useState([])
  const [discoveredRooms, setDiscoveredRooms] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeModal, setActiveModal] = useState(null)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  
  const [localAvatar, setLocalAvatar] = useState(user?.profile_photo_url)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const loadRooms = async () => {
      if (user?.id) {
        try {
          const data = await roomAPI.getUserRooms(user.id)
          setRooms(Array.isArray(data) ? data : [])
        } catch (error) {}
      }
    }
    loadRooms()
    const interval = setInterval(loadRooms, 5000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Global Search (users)
  useEffect(() => {
    const search = async () => {
      if (searchTerm.length >= 2) {
        try {
          const results = await authAPI.searchUsers(searchTerm)
          setGlobalUsers(results.filter(u => u.id !== user.id))
        } catch (error) {}
      } else {
        setGlobalUsers([])
      }
    }
    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, user?.id])

  // Discover groups/rooms (only show ones the user hasn't joined yet)
  useEffect(() => {
    const search = async () => {
      if (searchTerm.length >= 2 && user?.id) {
        try {
          const results = await roomAPI.discoverRooms(user.id, searchTerm)
          setDiscoveredRooms(results.filter(r => !r.is_member))
        } catch (error) {}
      } else {
        setDiscoveredRooms([])
      }
    }
    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, user?.id])

  const handleStartChatWithUser = async (targetUser) => {
    try {
      const roomName = targetUser.username
      const room = await roomAPI.createRoom(roomName, user.id)
      await roomAPI.joinRoom(room.id, targetUser.id)
      setSearchTerm('')
      setGlobalUsers([])
      setDiscoveredRooms([])
      onRoomSelect(room.id, roomName)
      await refreshRooms()
    } catch (error) {
      console.error('Failed to create room:', error)
    }
  }

  const refreshRooms = async () => {
    try {
      const newRooms = await roomAPI.getUserRooms(user.id)
      setRooms(Array.isArray(newRooms) ? newRooms : [])
    } catch (error) {}
  }

  const handleJoinRoom = async (room) => {
    try {
      await roomAPI.joinRoom(room.id, user.id)
      setSearchTerm('')
      setDiscoveredRooms([])
      onRoomSelect(room.id, room.name)
      await refreshRooms()
    } catch (error) {
      console.error('Failed to join room:', error)
    }
  }

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    try {
      const room = await roomAPI.createRoom(name, user.id)
      setNewGroupName('')
      setShowNewGroup(false)
      onRoomSelect(room.id, room.name)
      await refreshRooms()
    } catch (error) {
      console.error('Failed to create group:', error)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await mediaAPI.uploadImage(file)
      await authAPI.updateProfilePhoto(user.id, result.url)
      setLocalAvatar(result.url)
    } catch (err) {
      alert("Failed to update profile photo")
    }
  }

  const filteredRooms = rooms.filter(room => room.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="relative h-full w-full sm:w-80 glass border-r border-aurora-border flex flex-col flex-shrink-0 min-h-0 relative z-10">
      <div className="p-4 border-b border-aurora-border">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setActiveModal('profile')} className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-aurora-mint to-aurora-teal flex items-center justify-center font-bold text-aurora-900 overflow-hidden">
              {localAvatar ? (
                <img src={mediaAPI.resolveUrl(localAvatar)} alt="profile" className="w-full h-full object-cover" />
              ) : (
                user?.username?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="text-left min-w-0">
              <h1 className="text-lg font-extrabold text-gradient leading-tight">Whisper</h1>
            </div>
          </button>
          <button onClick={() => { logout(); onLogout(); }} className="icon-btn text-white/70 hover:text-red-400" title="Logout">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
        <div className="relative flex gap-2">
          <input
            type="text"
            placeholder="Search chats, users or groups..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field text-sm flex-1"
          />
          <button
            type="button"
            onClick={() => setShowNewGroup(!showNewGroup)}
            title="Create a new group"
            className="icon-btn text-white/70 hover:text-aurora-mint shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {showNewGroup && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCreateGroup}
              className="mt-2 flex gap-2 overflow-hidden"
            >
              <input
                autoFocus
                type="text"
                placeholder="Group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="input-field text-sm flex-1"
              />
              <button type="submit" className="btn-primary px-4 text-sm">Create</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Render existing chats */}
        {filteredRooms.map((room) => (
          <motion.div
            key={room.id}
            onClick={() => onRoomSelect(room.id, room.name)}
            className={`m-2 p-3 cursor-pointer rounded-xl flex items-center gap-3 transition-all ${
              selectedRoomId === room.id ? 'bg-white/10 ring-1 ring-aurora-teal/40' : 'hover:bg-white/5'
            }`}
          >
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(room.name)} flex items-center justify-center text-aurora-900 font-bold text-lg shrink-0`}>
              {room.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{room.name}</h3>
              <p className="text-xs text-white/40 mt-0.5">{formatDistanceToNow(new Date(room.created_at), { addSuffix: true })}</p>
            </div>
          </motion.div>
        ))}

        {/* Discoverable Groups Search Results */}
        {searchTerm && discoveredRooms.length > 0 && (
          <div className="mt-4 p-2 border-t border-aurora-border">
            <p className="text-xs text-white/40 uppercase px-2 mb-2">Groups</p>
            {discoveredRooms.map(room => (
              <motion.div
                key={room.id}
                className="p-3 rounded-xl flex items-center gap-3 hover:bg-white/5"
              >
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient(room.name)} flex items-center justify-center text-aurora-900 font-bold shrink-0`}>
                  {room.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{room.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {room.member_count} member{room.member_count === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => handleJoinRoom(room)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-btn-gradient text-aurora-900 shrink-0 hover:opacity-90 transition-opacity"
                >
                  Join
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Global Users Search Results */}
        {searchTerm && globalUsers.length > 0 && (
          <div className="mt-4 p-2 border-t border-aurora-border">
            <p className="text-xs text-white/40 uppercase px-2 mb-2">Global Users</p>
            {globalUsers.map(u => (
              <motion.div
                key={u.id}
                onClick={() => handleStartChatWithUser(u)}
                className="p-3 cursor-pointer rounded-xl flex items-center gap-3 hover:bg-white/5"
              >
                 <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold overflow-hidden">
                    {u.profile_photo_url ? (
                      <img src={mediaAPI.resolveUrl(u.profile_photo_url)} className="w-full h-full object-cover" />
                    ) : (
                      u.username.charAt(0).toUpperCase()
                    )}
                 </div>
                 <div className="flex-1 min-w-0">
                   <h3 className="font-semibold text-white truncate">{u.username}</h3>
                   <p className="text-xs text-white/40 mt-0.5">Click to start chat</p>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeModal && (
          <motion.div onClick={() => setActiveModal(null)} className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
            <motion.div onClick={e => e.stopPropagation()} className="glass-card w-full max-w-sm p-6 text-center">
              <h3 className="text-lg font-semibold text-white mb-4">Profile Settings</h3>
              
              <div 
                className="relative inline-block cursor-pointer group mb-4" 
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-aurora-mint to-aurora-teal flex items-center justify-center text-4xl font-bold text-aurora-900 overflow-hidden mx-auto border-4 border-aurora-glass">
                  {localAvatar ? (
                    <img src={mediaAPI.resolveUrl(localAvatar)} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-white text-xs font-semibold">Change</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
              
              <p className="text-white font-semibold text-xl">{user?.username}</p>
              <button onClick={() => setActiveModal(null)} className="btn-primary w-full mt-6">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}