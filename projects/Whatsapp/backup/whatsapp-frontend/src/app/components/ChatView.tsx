import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../store/authStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { roomAPI, mediaAPI, messageAPI, authAPI } from "../services/api";
import { formatDistanceToNow } from "date-fns";
import { Paperclip, Send, UserPlus, Users, X, Check, CheckCheck } from "lucide-react";

const AVATAR_COLORS = [
  ["#00A884", "#025144"],
  ["#5B8AF0", "#2B4BA0"],
  ["#E05C8A", "#8B1A4A"],
  ["#F5A623", "#A05000"],
  ["#8B5CF6", "#4C1D95"],
  ["#06B6D4", "#0E7490"],
];

function avatarColors(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash)];
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const [from, to] = avatarColors(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.38,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface Props {
  roomId: string | number;
  roomName: string;
}

export default function ChatView({ roomId, roomName }: Props) {
  const { user, token } = useAuthStore();
  const { messages: liveMessages, isConnected, error: wsError, sendMessage, sendImage, clearMessages } = useWebSocket(roomId, token);

  const [history, setHistory] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearchTerm, setAddSearchTerm] = useState("");
  const [addSearchResults, setAddSearchResults] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    setHistory([]);
    clearMessages();
    const load = async () => {
      try {
        const [memberData, msgData] = await Promise.all([
          roomAPI.getRoomMembers(roomId),
          messageAPI.getMessages(roomId, user.id),
        ]);
        setMembers(memberData || []);
        setHistory(msgData || []);
      } catch {}
    };
    load();
  }, [roomId, user?.id]);

  useEffect(() => {
    const search = async () => {
      if (addSearchTerm.length >= 2) {
        try {
          const results = await authAPI.searchUsers(addSearchTerm);
          const existingIds = new Set(members.map((m) => m.user_id));
          setAddSearchResults(results.filter((u: any) => !existingIds.has(u.id)));
        } catch {}
      } else {
        setAddSearchResults([]);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [addSearchTerm, members]);

  const handleAddMember = async (targetUser: any) => {
    try {
      await roomAPI.joinRoom(roomId, targetUser.id);
      const updated = await roomAPI.getRoomMembers(roomId);
      setMembers(updated || []);
      setShowAddMember(false);
      setAddSearchTerm("");
    } catch {
      alert("Failed to add member.");
    }
  };

  const allMessages = useMemo(
    () =>
      [...history, ...liveMessages.filter((lm) => !history.some((hm) => hm.id === lm.id))].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [history, liveMessages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && isConnected) {
      sendMessage(messageText.trim());
      setMessageText("");
      inputRef.current?.focus();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Only image files are supported");
    try {
      setUploadProgress(0);
      const result = await mediaAPI.uploadImage(file, setUploadProgress);
      sendImage(result.url, "");
    } catch {
      alert("Failed to upload image");
    } finally {
      setUploadProgress(null);
      e.target.value = "";
    }
  };

  const isMine = (senderId: any) => senderId === user?.id;
  const connStatus = isConnected ? "online" : wsError === "Reconnecting..." ? "reconnecting" : "connecting";

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden" style={{ background: "#0B141A" }}>
      {/* Header */}
      <div className="wa-chat-header flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={roomName} size={40} />
          <div className="min-w-0">
            <h2 className="font-semibold truncate" style={{ color: "#E9EDEF" }}>
              {roomName}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: isConnected ? "#00A884" : "#F5A623" }}
              />
              <p className="text-xs capitalize" style={{ color: "#8696A0" }}>
                {connStatus}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowAddMember(true)} className="wa-icon-btn" title="Add member">
            <UserPlus className="w-5 h-5" />
          </button>
          <button onClick={() => setShowMembers(!showMembers)} className="wa-icon-btn" title="View members">
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1 wa-scrollbar wa-chat-bg"
            style={{ minHeight: 0 }}
          >
            {allMessages.map((msg, i) => {
              const mine = isMine(msg.sender_id);
              const showDate =
                i === 0 ||
                new Date(msg.created_at).toDateString() !==
                  new Date(allMessages[i - 1].created_at).toDateString();
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="wa-date-pill">
                        {new Date(msg.created_at).toLocaleDateString([], {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex ${mine ? "justify-end" : "justify-start"} mb-1`}
                  >
                    <div
                      className={`wa-bubble ${mine ? "wa-bubble-sent" : "wa-bubble-received"} ${
                        msg.message_type === "image" ? "!p-1.5" : ""
                      }`}
                    >
                      {msg.message_type === "image" && msg.media_url ? (
                        <div>
                          <img
                            src={mediaAPI.resolveUrl(msg.media_url)}
                            alt="media"
                            className="rounded-lg max-h-64 object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                            onClick={() => setPreviewImage(mediaAPI.resolveUrl(msg.media_url))}
                            loading="lazy"
                          />
                          {msg.content && (
                            <p className="px-1 pt-1 text-sm break-words" style={{ color: mine ? "#E9EDEF" : "#E9EDEF" }}>
                              {msg.content}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm break-words leading-relaxed">{msg.content}</p>
                      )}
                      <div className={`flex items-center gap-1 mt-0.5 ${mine ? "justify-end" : "justify-end"}`}>
                        <span className="text-[10px]" style={{ color: mine ? "rgba(233,237,239,0.6)" : "#8696A0" }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {mine && (
                          <CheckCheck className="w-3 h-3" style={{ color: "#53BDEB" }} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Upload progress */}
          <AnimatePresence>
            {uploadProgress !== null && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="px-4 pb-2">
                <div className="rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "#00A884" }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <form onSubmit={handleSend} className="wa-input-bar flex items-center gap-2 px-4 py-3">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              className="wa-icon-btn shrink-0"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message"
              disabled={!isConnected}
              className="wa-msg-input flex-1"
            />
            <motion.button
              type="submit"
              disabled={!isConnected || !messageText.trim()}
              className="wa-send-btn shrink-0"
              whileTap={{ scale: 0.9 }}
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </form>
        </div>

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="border-l shrink-0 flex flex-col overflow-hidden"
              style={{ borderColor: "rgba(134,150,160,0.15)", background: "#111B21" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(134,150,160,0.15)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "#E9EDEF" }}>
                  Members ({members.length})
                </h3>
                <button onClick={() => setShowMembers(false)} className="wa-icon-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto wa-scrollbar">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(134,150,160,0.08)" }}>
                    <Avatar name={m.username} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#E9EDEF" }}>
                        {m.username}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#8696A0" }}>
                        {formatDistanceToNow(new Date(m.last_seen_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddMember(false)}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="wa-modal w-full max-w-sm p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: "#E9EDEF" }}>
                  Add member
                </h3>
                <button onClick={() => setShowAddMember(false)} className="wa-icon-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Search by username…"
                value={addSearchTerm}
                onChange={(e) => setAddSearchTerm(e.target.value)}
                className="wa-input mb-3"
              />
              <div className="max-h-56 overflow-y-auto wa-scrollbar min-h-[80px]">
                {addSearchTerm.length < 2 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#8696A0" }}>
                    Type at least 2 characters
                  </p>
                ) : addSearchResults.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#8696A0" }}>
                    No users found
                  </p>
                ) : (
                  addSearchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAddMember(u)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:opacity-80 transition-opacity text-left"
                      style={{ borderBottom: "1px solid rgba(134,150,160,0.1)" }}
                    >
                      <Avatar name={u.username} size={36} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#E9EDEF" }}>
                          {u.username}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#8696A0" }}>
                          Tap to add
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image preview */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-zoom-out"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 wa-icon-btn"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img src={previewImage} alt="preview" className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
