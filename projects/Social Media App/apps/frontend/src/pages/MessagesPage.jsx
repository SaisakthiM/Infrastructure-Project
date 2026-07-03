import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoChevronBack, IoPaperPlane, IoSearch,
  IoImageOutline, IoEllipsisVertical,
} from 'react-icons/io5';
import { messagesAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { timeAgo } from '../utils';
import { toast } from 'react-toastify';

function ConvItem({ conv, active, onClick, me }) {
  const other = conv.participants.find((p) => p.id !== me?.id) || conv.participants[0];
  const last  = conv.last_message;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left ${
        active ? 'bg-violet-500/12' : 'hover:bg-white/4'
      }`}
    >
      <Avatar user={other} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold truncate">{other?.profile_name || other?.username}</p>
          {last && <p className="text-[11px] text-white/25 flex-shrink-0">{timeAgo(last.created_at)}</p>}
        </div>
        {last && (
          <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? 'text-white font-medium' : 'text-white/40'}`}>
            {last.sender?.id === me?.id ? 'You: ' : ''}{last.content}
          </p>
        )}
      </div>
      {conv.unread_count > 0 && (
        <span className="flex-shrink-0 bg-violet-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
          {conv.unread_count}
        </span>
      )}
    </button>
  );
}

function ChatPanel({ convId, me, onBack }) {
  const [messages, setMessages] = useState([]);
  const [conv, setConv]         = useState(null);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);
  const fileRef                 = useRef(null);

  useEffect(() => {
    if (!convId) return;
    setLoading(true);
    messagesAPI.messages(convId).then(({ data }) => {
      setMessages(data.results);
      setLoading(false);
    });
    // Poll for new messages every 5s
    const id = setInterval(() => {
      messagesAPI.messages(convId).then(({ data }) => setMessages(data.results));
    }, 5000);
    return () => clearInterval(id);
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('content', text.trim());
      const { data } = await messagesAPI.send(convId, fd);
      setMessages((m) => [...m, data]);
      setText('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const other = conv?.participants?.find((p) => p.id !== me?.id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <button onClick={onBack} className="md:hidden text-white/50 hover:text-white mr-1">
          <IoChevronBack size={22} />
        </button>
        <Avatar user={other} size="sm" />
        <div>
          <p className="text-sm font-semibold">{other?.profile_name || other?.username}</p>
          <p className="text-xs text-white/30">@{other?.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && <div className="flex justify-center py-8"><Spinner /></div>}
        {messages.map((msg) => {
          const isMe = msg.sender.id === me?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isMe && <Avatar user={msg.sender} size="xs" className="mt-1 flex-shrink-0" />}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-white/8 text-white/90 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-white/20 px-1">{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 px-3 py-3 border-t border-white/8 flex-shrink-0">
        <button type="button" onClick={() => fileRef.current?.click()} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
          <IoImageOutline size={20} />
        </button>
        <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="flex-1 bg-white/6 border border-white/8 rounded-xl px-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/40 transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white rounded-xl p-2.5 transition-all"
        >
          {sending ? <Spinner size="sm" /> : <IoPaperPlane size={16} />}
        </button>
      </form>
    </div>
  );
}

export default function MessagesPage() {
  const { user }              = useAuth();
  const [convs, setConvs]     = useState([]);
  const [active, setActive]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [newSearch, setNewSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    messagesAPI.conversations().then(({ data }) => {
      setConvs(data);
      setLoading(false);
    });
  }, []);

  const searchUsers = async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await usersAPI.search(q);
    setSearchResults(data);
    setSearching(false);
  };

  const startConv = async (username) => {
    const { data } = await messagesAPI.start(username);
    setConvs((c) => {
      const exists = c.find((x) => x.id === data.id);
      if (!exists) return [data, ...c];
      return c;
    });
    setActive(data.id);
    setNewSearch('');
    setSearchResults([]);
  };

  return (
    <div className="h-[calc(100vh-0px)] flex max-w-4xl mx-auto border-x border-white/5">
      {/* Conversations list */}
      <div className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/8 flex-shrink-0`}>
        <div className="px-4 py-4 border-b border-white/8">
          <h1 className="text-lg font-bold mb-3">Messages</h1>
          {/* New conversation search */}
          <div className="relative">
            <IoSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={newSearch}
              onChange={(e) => { setNewSearch(e.target.value); searchUsers(e.target.value); }}
              placeholder="New conversation…"
              className="w-full bg-white/6 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-violet-500/40 transition-all"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConv(u.username)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <Avatar user={u} size="sm" />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{u.profile_name || u.username}</p>
                    <p className="text-[11px] text-white/40">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && <div className="flex justify-center py-8"><Spinner /></div>}
          {!loading && convs.length === 0 && (
            <p className="text-center text-white/25 text-sm py-10">No conversations yet</p>
          )}
          {convs.map((c) => (
            <ConvItem
              key={c.id}
              conv={c}
              active={active === c.id}
              onClick={() => setActive(c.id)}
              me={user}
            />
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${active ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {active ? (
          <ChatPanel convId={active} me={user} onBack={() => setActive(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20">
            <div className="text-center">
              <p className="text-5xl mb-3">💬</p>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">or search for someone to message</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

