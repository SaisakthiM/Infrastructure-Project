import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoPaperPlane, IoHeartOutline } from 'react-icons/io5';
import { postsAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { timeAgo } from '../../utils';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

export default function CommentsDrawer({ open, onClose, post, onUpdate }) {
  const { user }              = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef(null);

  useEffect(() => {
    if (!open) return;
    postsAPI.comments(post.id).then(({ data }) => setComments(data)).catch(() => {});
  }, [open, post.id]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const { data } = await postsAPI.addComment(post.id, { content: text.trim() });
      setComments((c) => [...c, data]);
      onUpdate?.({ comments_count: post.comments_count + 1 });
      setText('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (id) => {
    try {
      await postsAPI.delComment(id);
      setComments((c) => c.filter((x) => x.id !== id));
      onUpdate?.({ comments_count: Math.max(0, post.comments_count - 1) });
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 md:right-auto md:left-auto md:top-0 md:bottom-0 md:w-[420px] bg-[#111] border-t md:border-t-0 md:border-l border-white/10 z-50 flex flex-col rounded-t-3xl md:rounded-none"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ maxHeight: '85vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-sm">Comments</h3>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comments.length === 0 && (
                <p className="text-center text-white/30 text-sm py-8">No comments yet. Be the first!</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <Link to={`/profile/${c.author.username}`}>
                    <Avatar user={c.author} size="sm" />
                  </Link>
                  <div className="flex-1">
                    <p className="text-sm">
                      <Link to={`/profile/${c.author.username}`} className="font-semibold text-white hover:text-violet-400 transition-colors mr-1.5">
                        {c.author.username}
                      </Link>
                      <span className="text-white/70">{c.content}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/30">{timeAgo(c.created_at)}</span>
                      {c.author.id === user?.id && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-xs text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {/* Replies */}
                    {c.replies?.map((r) => (
                      <div key={r.id} className="flex gap-2 mt-3">
                        <Avatar user={r.author} size="xs" />
                        <div>
                          <p className="text-sm">
                            <Link to={`/profile/${r.author.username}`} className="font-semibold text-white mr-1.5">
                              {r.author.username}
                            </Link>
                            <span className="text-white/70">{r.content}</span>
                          </p>
                          <span className="text-xs text-white/30">{timeAgo(r.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 mt-1">
                    <IoHeartOutline size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={submit} className="flex items-center gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
              <Avatar user={user} size="sm" />
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || loading}
                className="text-violet-400 hover:text-violet-300 disabled:opacity-30 transition-colors"
              >
                <IoPaperPlane size={18} />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

