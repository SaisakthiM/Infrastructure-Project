import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'
import { roomAPI } from '../services/api'
import ChatList from '../components/ChatList'
import ChatView from '../components/ChatView'

export default function ChatPage() {
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedRoomName, setSelectedRoomName] = useState('')
  const [rooms, setRooms] = useState([])

  useEffect(() => {
    if (!user || !token) {
      navigate('/login')
    }
  }, [user, token, navigate])

  const handleRoomSelect = (roomId) => {
    setSelectedRoomId(roomId)
  }

  const handleLogout = () => {
    navigate('/login')
  }

  return (
    <div className="aurora-bg fixed inset-0 flex">
      <ChatList
        selectedRoomId={selectedRoomId}
        onRoomSelect={(id, name) => {
          setSelectedRoomId(id)
          setSelectedRoomName(name)
        }}
        onLogout={handleLogout}
      />

      <div className="flex flex-col flex-1 relative z-10">
        {selectedRoomId ? (
          <ChatView roomId={selectedRoomId} roomName={selectedRoomName} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden sm:flex flex-1 items-center justify-center bg-aurora-glass backdrop-blur-xl border-l border-aurora-border"
          >
            <div className="text-center">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-btn-gradient mb-4 shadow-[0_0_50px_rgba(52,232,158,0.35)]"
              >
                <svg className="w-10 h-10 text-aurora-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </motion.div>
              <p className="text-lg font-semibold text-white">Select a chat to start messaging</p>
              <p className="text-sm text-white/40 mt-2">Or search for users in the sidebar</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}