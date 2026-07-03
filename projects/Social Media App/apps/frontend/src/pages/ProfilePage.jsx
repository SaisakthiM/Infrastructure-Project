import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IoGrid, IoBookmarkOutline, IoPencilOutline, IoClose, IoCamera } from 'react-icons/io5';
import { usersAPI, postsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFollow } from '../hooks';
import Avatar from '../components/common/Avatar';
import { Spinner, UserCardSkeleton } from '../components/common/Loaders';
import { formatNumber, timeAgo } from '../utils';
import PostDetailModal from '../components/posts/PostDetailModal';
import Modal from '../components/common/Modal';
import { toast } from 'react-toastify';

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
        active ? 'border-white text-white' : 'border-transparent text-white/30 hover:text-white/60'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function EditProfileModal({ open, onClose, user, onSaved }) {
  const [form, setForm] = useState({
    profile_name: user.profile_name || '',
    bio:          user.bio          || '',
    website:      user.website      || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAvatar = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setAvatar(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (avatar) fd.append('profile_picture', avatar);
      const { data } = await usersAPI.update(user.username, fd);
      onSaved(data);
      toast.success('Profile updated!');
      onClose();
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" size="sm">
      <div className="p-5 space-y-5">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar user={preview ? { profile_picture: preview } : user} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 bg-violet-600 hover:bg-violet-500 rounded-full p-1.5 transition-colors"
            >
              <IoCamera size={14} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
        </div>

        {[
          { k: 'profile_name', label: 'Display name', placeholder: 'Your name' },
          { k: 'bio',          label: 'Bio',          placeholder: 'Tell us about yourself', textarea: true },
          { k: 'website',      label: 'Website',      placeholder: 'https://yoursite.com' },
        ].map(({ k, label, placeholder, textarea }) => (
          <div key={k}>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">{label}</label>
            {textarea ? (
              <textarea
                value={form[k]}
                onChange={set(k)}
                rows={3}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 resize-none transition-all"
              />
            ) : (
              <input
                value={form[k]}
                onChange={set(k)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 transition-all"
              />
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Spinner size="sm" />} Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FollowListModal({ open, onClose, title, username, type }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fn = type === 'followers' ? usersAPI.followers : usersAPI.following;
    fn(username).then(({ data }) => { setUsers(data); setLoading(false); }).catch(() => setLoading(false));
  }, [open, username, type]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <UserCardSkeleton key={i} />)}
          </div>
        )}
        {!loading && users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar user={u} size="sm" />
              <div>
                <p className="text-sm font-semibold">{u.profile_name || u.username}</p>
                <p className="text-xs text-white/40">@{u.username}</p>
              </div>
            </div>
          </div>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-center text-white/30 text-sm py-8">None yet</p>
        )}
      </div>
    </Modal>
  );
}

export default function ProfilePage() {
  const { username }         = useParams();
  const { user: me, updateUser } = useAuth();
  const navigate             = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [posts, setPosts]       = useState([]);
  const [saved, setSaved]       = useState([]);
  const [tab, setTab]           = useState('posts');
  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following'
  const [loading, setLoading]   = useState(true);

  const isMe = me?.username === username;

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setPosts([]);
    usersAPI.profile(username)
      .then(({ data }) => { setProfile(data); setLoading(false); })
      .catch(() => { navigate('/'); });
    postsAPI.userPosts(username).then(({ data }) => setPosts(data)).catch(() => {});
  }, [username]);

  useEffect(() => {
    if (isMe && tab === 'saved') {
      postsAPI.saved().then(({ data }) => setSaved(data)).catch(() => {});
    }
  }, [tab, isMe]);

  const { following, loading: followLoading, toggle: toggleFollow } =
    useFollow(username, profile?.is_following);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) return null;

  const displayPosts = tab === 'saved' ? saved : posts;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 mb-10">
        <Avatar user={profile} size="2xl" />

        <div className="flex-1">
          {/* Name row */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1 className="text-xl font-bold">{profile.username}</h1>
            {isMe ? (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white/8 hover:bg-white/12 rounded-lg text-sm font-medium transition-all"
              >
                <IoPencilOutline size={14} /> Edit profile
              </button>
            ) : (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  following
                    ? 'bg-white/8 hover:bg-red-500/20 hover:text-red-400 text-white'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {followLoading ? <Spinner size="sm" /> : following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 mb-4">
            {[
              { label: 'posts',     val: profile.posts_count },
              { label: 'followers', val: profile.followers_count, onClick: () => setFollowModal('followers') },
              { label: 'following', val: profile.following_count, onClick: () => setFollowModal('following') },
            ].map(({ label, val, onClick }) => (
              <button key={label} onClick={onClick} className="text-center hover:opacity-80 transition-opacity" disabled={!onClick}>
                <p className="font-bold text-white">{formatNumber(val)}</p>
                <p className="text-sm text-white/50">{label}</p>
              </button>
            ))}
          </div>

          {/* Bio */}
          {profile.profile_name && <p className="font-semibold text-sm">{profile.profile_name}</p>}
          {profile.bio && <p className="text-sm text-white/60 mt-1 leading-relaxed">{profile.bio}</p>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 hover:underline mt-1 block">
              {profile.website}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-t border-white/8 flex justify-center gap-8 mb-4">
        <TabButton active={tab === 'posts'} onClick={() => setTab('posts')} icon={IoGrid} label="Posts" />
        {isMe && <TabButton active={tab === 'saved'} onClick={() => setTab('saved')} icon={IoBookmarkOutline} label="Saved" />}
      </div>

      {/* Grid */}
      {displayPosts.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-4xl mb-3">{tab === 'saved' ? '🔖' : '📷'}</p>
          <p className="font-medium">{tab === 'saved' ? 'No saved posts' : 'No posts yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {displayPosts.map((post, i) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelected(post)}
              className="relative aspect-square group overflow-hidden bg-[#111]"
            >
              {post.media?.[0] ? (
                <img src={post.media[0].file} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 p-3">
                  <p className="text-white/40 text-xs line-clamp-4 text-left">{post.content}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {selected && <PostDetailModal post={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={profile}
        onSaved={(data) => { setProfile(data); if (isMe) updateUser(data); }}
      />

      <FollowListModal
        open={!!followModal}
        onClose={() => setFollowModal(null)}
        title={followModal === 'followers' ? 'Followers' : 'Following'}
        username={username}
        type={followModal}
      />
    </div>
  );
}

