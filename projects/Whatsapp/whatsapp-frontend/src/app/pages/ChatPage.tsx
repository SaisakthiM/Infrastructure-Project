import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { useAuthStore } from "../store/authStore";
import ChatList from "../components/ChatList";
import ChatView from "../components/ChatView";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [selectedRoomId, setSelectedRoomId] = useState<string | number | null>(null);
  const [selectedRoomName, setSelectedRoomName] = useState("");

  useEffect(() => {
    if (!user || !token) navigate("/login");
  }, [user, token, navigate]);

  const handleLogout = () => navigate("/login");

  return (
    <div className="wa-root flex fixed inset-0">
      <ChatList
        selectedRoomId={selectedRoomId}
        onRoomSelect={(id: string | number, name: string) => {
          setSelectedRoomId(id);
          setSelectedRoomName(name);
        }}
        onLogout={handleLogout}
      />

      <div className="flex flex-col flex-1 relative overflow-hidden">
        {selectedRoomId ? (
          <ChatView roomId={selectedRoomId} roomName={selectedRoomName} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden sm:flex flex-1 flex-col items-center justify-center wa-welcome-bg"
          >
            <div className="text-center select-none">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-[100px] h-[100px] rounded-full mb-6"
                style={{
                  background: "radial-gradient(circle, rgba(0,230,118,0.18) 0%, transparent 70%)",
                  border: "1px solid rgba(0,230,118,0.3)",
                  boxShadow: "0 0 40px rgba(0,230,118,0.12)",
                }}
              >
                <svg className="w-12 h-12" style={{ color: "#00E676" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </motion.div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: "#E9EDEF" }}>
                Whisper Web
              </h2>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: "#8696A0" }}>
                Send and receive messages without keeping your phone online.
              </p>
              <p className="text-xs mt-3" style={{ color: "#8696A0" }}>
                Select a chat to start messaging
              </p>
            </div>

            <div className="absolute bottom-8 flex items-center gap-2" style={{ color: "rgba(0,230,118,0.45)" }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1a6 6 0 110 12A6 6 0 018 2zm.5 4.5v4a.5.5 0 01-1 0v-4a.5.5 0 011 0zm0-2a.5.5 0 11-1 0 .5.5 0 011 0z"/>
              </svg>
              <span className="text-xs">End-to-end encrypted</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
