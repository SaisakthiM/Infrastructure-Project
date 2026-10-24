import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { IoClose, IoHeartOutline, IoHeart, IoChatbubbleOutline, IoBookmarkOutline, IoBookmark } from 'react-icons/io5';
import Avatar from '../common/Avatar';
import { useLike, useSave } from '../../hooks';
import { timeAgo, formatNumber } from '../../utils';
import CommentsDrawer from './CommentsDrawer';

export default function PostDetailModal({ post: initialPost, onClose }) {
  const [post, setPost]           = useState(initialPost);
  const [showComments, setShowComments] = useState(false);

  const update = (patch) => setPost((p) => ({ ...p, ...patch }));
  const { liked, count, toggle }  = useLike(post, update);
  const { saved, toggle: toggleSave } = useSave(post, update);

  /* portalled to <body> so the sheet and its scrim clear the fixed HUD band (see Modal.jsx);
     the scrim deliberately stops at --hud-h — the ward plate and bank balance stay visible. */
  return createPortal(
    <>
      <motion.div
        className="fixed left-0 right-0 top-[var(--hud-h)] bottom-0 bg-zinc-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass overflow-hidden max-w-3xl w-full max-h-[calc(100vh_-_var(--hud-h)_-_2rem)] flex flex-col md:flex-row"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media */}
          {post.media?.[0] && (
            <div className="md:w-1/2 bg-zinc-950 flex items-center">
              <img src={post.media[0].file} alt="" className="w-full object-contain max-h-[70vh]" />
            </div>
          )}

          {/* Info */}
          <div className={`flex flex-col ${post.media?.[0] ? 'md:w-1/2' : 'w-full'} min-h-0`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-950/10 flex-shrink-0">
              <Link to={`/profile/${post.author.username}`} onClick={onClose} className="flex items-center gap-2.5">
                <Avatar user={post.author} size="sm" />
                <span className="text-sm font-semibold">{post.author.profile_name || post.author.username}</span>
              </Link>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-950 transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            {/* Caption */}
            {post.content && (
              <div className="px-4 py-3 border-b border-zinc-950/10 flex-shrink-0">
                <p className="text-sm text-zinc-800 leading-relaxed">
                  <span className="font-semibold text-zinc-950 mr-1.5">{post.author.username}</span>
                  {post.content}
                </p>
                <p className="text-xs text-zinc-500 mt-2">{timeAgo(post.created_at)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-zinc-950/10 mt-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4">
                  <button onClick={toggle} className={`transition-all ${liked ? 'text-red-500' : 'text-zinc-600 hover:text-zinc-950'}`}>
                    {liked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                  </button>
                  <button onClick={() => setShowComments(true)} className="text-zinc-600 hover:text-zinc-950 transition-colors">
                    <IoChatbubbleOutline size={21} />
                  </button>
                </div>
                <button onClick={toggleSave} className={`transition-all ${saved ? 'text-violet-400' : 'text-zinc-600 hover:text-zinc-950'}`}>
                  {saved ? <IoBookmark size={21} /> : <IoBookmarkOutline size={21} />}
                </button>
              </div>
              {count > 0 && <p className="text-sm font-semibold">{formatNumber(count)} likes</p>}
              {post.comments_count > 0 && (
                <button onClick={() => setShowComments(true)} className="text-xs text-zinc-500 hover:text-zinc-600 mt-0.5">
                  View all {post.comments_count} comments
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <CommentsDrawer open={showComments} onClose={() => setShowComments(false)} post={post} onUpdate={update} />
    </>,
    document.body
  );
}

