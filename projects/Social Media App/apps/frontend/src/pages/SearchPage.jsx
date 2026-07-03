import { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoSearch, IoClose } from 'react-icons/io5';
import { usersAPI, postsAPI } from '../api';
import Avatar from '../components/common/Avatar';
import { Spinner } from '../components/common/Loaders';
import { useFollow } from '../hooks';
import { useAuth } from '../context/AuthContext';

function UserResult({ user }) {
  const { user: me } = useAuth();
  const { following, toggle } = useFollow(user.username, user.is_following);
  const isMe = me?.id === user.id;

  return (
    <div className="flex items-center justify-between px-1 py-2.5">
      <Link to={`/profile/${user.username}`} className="flex items-center gap-3 group flex-1 min-w-0">
        <Avatar user={user} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate">
            {user.profile_name || user.username}
          </p>
          <p className="text-xs text-white/40 truncate">@{user.username}</p>
        </div>
      </Link>
      {!isMe && (
        <button
          onClick={toggle}
          className={`ml-3 flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            following ? 'bg-white/8 text-white hover:bg-white/12' : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery]         = useState('');
  const [tab, setTab]             = useState('users');
  const [users, setUsers]         = useState([]);
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const debounceRef               = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setUsers([]); setPosts([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const [uRes, pRes] = await Promise.all([
        usersAPI.search(q),
        postsAPI.search(q),
      ]);
      setUsers(uRes.data);
      setPosts(pRes.data);
    } catch {}
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 400);
  };

  const clear = () => { setQuery(''); setUsers([]); setPosts([]); setSearched(false); };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold mb-5">Search</h1>

      {/* Search input */}
      <div className="relative mb-5">
        <IoSearch size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search people, posts…"
          autoFocus
          className="w-full bg-white/6 border border-white/8 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500/50 transition-all"
        />
        {query && (
          <button onClick={clear} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
            <IoClose size={16} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {!loading && searched && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
            {['users', 'posts'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                  tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {t} {t === 'users' ? `(${users.length})` : `(${posts.length})`}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {users.length === 0
                  ? <p className="text-center text-white/30 py-8 text-sm">No users found for "{query}"</p>
                  : <div className="divide-y divide-white/5">{users.map((u) => <UserResult key={u.id} user={u} />)}</div>
                }
              </motion.div>
            )}
            {tab === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {posts.length === 0
                  ? <p className="text-center text-white/30 py-8 text-sm">No posts found for "{query}"</p>
                  : (
                    <div className="grid grid-cols-3 gap-0.5">
                      {posts.map((p) => (
                        <Link key={p.id} to={`/post/${p.id}`} className="aspect-square bg-[#111] overflow-hidden group">
                          {p.media?.[0]
                            ? <img src={p.media[0].file} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <div className="w-full h-full flex items-center justify-center p-3"><p className="text-white/40 text-xs line-clamp-4">{p.content}</p></div>
                          }
                        </Link>
                      ))}
                    </div>
                  )
                }
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {!searched && !loading && (
        <div className="text-center py-16 text-white/20">
          <IoSearch size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Search for people or posts</p>
        </div>
      )}
    </div>
  );
}

