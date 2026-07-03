import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "../store/authStore";
import { roomAPI, authAPI, mediaAPI } from "../services/api";
import { formatDistanceToNow } from "date-fns";
import { Search, Plus, X, LogOut, Camera, Users } from "lucide-react";

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

function Avatar({ name, photoUrl, size = 44 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [from, to] = avatarColors(name);
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        background: photoUrl ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.38,
      }}
    >
      {photoUrl ? (
        <img src={mediaAPI.resolveUrl(photoUrl)} alt={name} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

interface Props {
  selectedRoomId: string | number | null;
  onRoomSelect: (id: string | number, name: string) => void;
  onLogout: () => void;
}

export default function ChatList({ selectedRoomId, onRoomSelect, onLogout }: Props) {
  const { user, logout } = useAuthStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [globalUsers, setGlobalUsers] = useState<any[]>([]);
  const [discoveredRooms, setDiscoveredRooms] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [localAvatar, setLocalAvatar] = useState(user?.profile_photo_url);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadRooms = async () => {
      if (user?.id) {
        try {
          const data = await roomAPI.getUserRooms(user.id);
          setRooms(Array.isArray(data) ? data : []);
        } catch {}
      }
    };
    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.length >= 2) {
        try {
          const results = await authAPI.searchUsers(searchTerm);
          setGlobalUsers(results.filter((u: any) => u.id !== user?.id));
        } catch {}
      } else {
        setGlobalUsers([]);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [searchTerm, user?.id]);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.length >= 2 && user?.id) {
        try {
          const results = await roomAPI.discoverRooms(user.id, searchTerm);
          setDiscoveredRooms(results.filter((r: any) => !r.is_member));
        } catch {}
      } else {
        setDiscoveredRooms([]);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [searchTerm, user?.id]);

  const refreshRooms = async () => {
    try {
      const data = await roomAPI.getUserRooms(user!.id);
      setRooms(Array.isArray(data) ? data : []);
    } catch {}
  };

  const handleStartChat = async (targetUser: any) => {
    try {
      const room = await roomAPI.createRoom(targetUser.username, user!.id);
      await roomAPI.joinRoom(room.id, targetUser.id);
      setSearchTerm("");
      setGlobalUsers([]);
      onRoomSelect(room.id, targetUser.username);
      await refreshRooms();
    } catch {}
  };

  const handleJoinRoom = async (room: any) => {
    try {
      await roomAPI.joinRoom(room.id, user!.id);
      setSearchTerm("");
      setDiscoveredRooms([]);
      onRoomSelect(room.id, room.name);
      await refreshRooms();
    } catch {}
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const room = await roomAPI.createRoom(name, user!.id);
      setNewGroupName("");
      setShowNewGroup(false);
      onRoomSelect(room.id, room.name);
      await refreshRooms();
    } catch {}
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { uploadImage, resolveUrl } = mediaAPI;
      const result = await uploadImage(file);
      await authAPI.updateProfilePhoto(user!.id, result.url);
      setLocalAvatar(result.url);
    } catch {
      alert("Failed to update profile photo");
    }
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const isSearching = searchTerm.length >= 2;

  return (
    <div className="wa-sidebar flex flex-col h-full w-full sm:w-[360px] shrink-0">
      {/* Header */}
      <div className="wa-sidebar-header flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-3 hover:opacity-85 transition-opacity"
        >
          <Avatar name={user?.username || "U"} photoUrl={localAvatar} size={40} />
          <span className="font-bold text-lg tracking-tight" style={{ color: "#E9EDEF" }}>
            Whisper
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewGroup(!showNewGroup)}
            className="wa-icon-btn"
            title="New group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={() => { logout(); onLogout(); }}
            className="wa-icon-btn hover:text-red-400"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3" style={{ background: "#111B21" }}>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#8696A0" }} />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="wa-search-input pl-10"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 wa-icon-btn p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showNewGroup && (
            <motion.form
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              onSubmit={handleCreateGroup}
              className="flex gap-2 overflow-hidden"
            >
              <input
                autoFocus
                type="text"
                placeholder="Group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="wa-search-input flex-1 text-sm"
              />
              <button type="submit" className="wa-btn-sm">
                <Plus className="w-4 h-4" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto min-h-0 wa-scrollbar">
        {!isSearching && filteredRooms.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(0,168,132,0.1)" }}>
              <svg className="w-8 h-8" style={{ color: "#00A884" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: "#8696A0" }}>No chats yet</p>
            <p className="text-xs text-center px-6" style={{ color: "#8696A0", opacity: 0.7 }}>Search for a user above to start a conversation</p>
          </div>
        )}

        {filteredRooms.map((room) => (
          <motion.button
            key={room.id}
            onClick={() => onRoomSelect(room.id, room.name)}
            className={`wa-chat-item w-full ${selectedRoomId === room.id ? "wa-chat-item-active" : ""}`}
            whileTap={{ scale: 0.99 }}
          >
            <Avatar name={room.name} size={48} />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate" style={{ color: "#E9EDEF" }}>
                  {room.name}
                </span>
                <span className="text-[11px] shrink-0 ml-2" style={{ color: "#8696A0" }}>
                  {formatDistanceToNow(new Date(room.created_at), { addSuffix: false })}
                </span>
              </div>
              <p className="text-sm truncate mt-0.5" style={{ color: "#8696A0" }}>
                Tap to open chat
              </p>
            </div>
          </motion.button>
        ))}

        {/* Group results */}
        {isSearching && discoveredRooms.length > 0 && (
          <div>
            <div className="wa-section-label">Groups</div>
            {discoveredRooms.map((room) => (
              <div key={room.id} className="wa-chat-item">
                <Avatar name={room.name} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate" style={{ color: "#E9EDEF" }}>{room.name}</span>
                    <button
                      onClick={() => handleJoinRoom(room)}
                      className="wa-btn-xs shrink-0 ml-2"
                    >
                      Join
                    </button>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#8696A0" }}>
                    {room.member_count} member{room.member_count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User results */}
        {isSearching && globalUsers.length > 0 && (
          <div>
            <div className="wa-section-label">Contacts</div>
            {globalUsers.map((u) => (
              <motion.button
                key={u.id}
                onClick={() => handleStartChat(u)}
                className="wa-chat-item w-full"
                whileTap={{ scale: 0.99 }}
              >
                <Avatar name={u.username} photoUrl={u.profile_photo_url} size={48} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate" style={{ color: "#E9EDEF" }}>{u.username}</p>
                  <p className="text-sm mt-0.5" style={{ color: "#8696A0" }}>Tap to start chat</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {isSearching && globalUsers.length === 0 && discoveredRooms.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "#8696A0" }}>No results for "{searchTerm}"</p>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProfile(false)}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="wa-modal w-full max-w-sm p-6 text-center"
            >
              <h3 className="text-base font-semibold mb-5" style={{ color: "#E9EDEF" }}>
                Profile
              </h3>
              <div
                className="relative inline-block cursor-pointer group mb-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar name={user?.username || "U"} photoUrl={localAvatar} size={88} />
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white mb-1" />
                  <span className="text-white text-[10px] font-medium">Change</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              <p className="text-lg font-semibold mt-1" style={{ color: "#E9EDEF" }}>
                {user?.username}
              </p>
              <p className="text-xs mt-1 mb-6" style={{ color: "#8696A0" }}>
                Available
              </p>
              <button onClick={() => setShowProfile(false)} className="wa-btn-primary w-full">
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
