import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoHeartOutline, IoHeart,
  IoChatbubbleOutline,
  IoBookmarkOutline, IoBookmark,
  IoPaperPlaneOutline,
  IoEllipsisHorizontal, IoTrashOutline,
} from 'react-icons/io5';
import Avatar from '../common/Avatar';
import { useLike, useSave } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { postsAPI } from '../../api';
import { timeAgo, formatNumber } from '../../utils';
import { toast } from 'react-toastify';
import CommentsDrawer from './CommentsDrawer';

export default function PostCard({ post, onUpdate, onRemove }) {
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const [showMenu, setShowMenu]       = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [mediaIdx, setMediaIdx]       = useState(0);

  const { liked, count: likesCount, toggle: toggleLike } = useLike(post, onUpdate);
  const { saved, toggle: toggleSave }                    = useSave(post, onUpdate);

  const isOwner = user?.id === post.author.id;

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    try {
      await postsAPI.delete(post.id);
      onRemove?.(post.id);
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDoubleTap = () => {
    if (!liked) toggleLike();
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/profile/${post.author.username}`} className="flex items-center gap-2.5 group">
          <Avatar user={post.author} size="sm" />
          <div>
            <p className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors leading-tight">
              {post.author.profile_name || post.author.username}
            </p>
            <p className="text-xs text-white/40">@{post.author.username} · {timeAgo(post.created_at)}</p>
          </div>
        </Link>
        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu((s) => !s)}
              className="text-white/30 hover:text-white p-1 rounded-lg transition-colors"
            >
              <IoEllipsisHorizontal size={18} />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1,   y: 0  }}
                  exit={{   opacity: 0, scale: 0.9, y: -4  }}
                  className="absolute right-0 top-8 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden w-36"
                >
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <IoTrashOutline size={15} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Media */}
      {post.media?.length > 0 && (
        <div className="relative bg-black" onDoubleClick={handleDoubleTap}>
          <img
            src={post.media[mediaIdx].file}
            alt=""
            className="w-full max-h-[520px] object-cover cursor-pointer"
            onClick={() => navigate(`/post/${post.id}`)}
          />
          {post.media.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {post.media.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMediaIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === mediaIdx ? 'bg-white w-3' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLike}
              className={`transition-all active:scale-90 ${liked ? 'text-red-500' : 'text-white/60 hover:text-white'}`}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={liked ? 'liked' : 'unliked'}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  exit={{    scale: 0.7 }}
                >
                  {liked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <button
              onClick={() => setShowComments(true)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <IoChatbubbleOutline size={21} />
            </button>
            <button className="text-white/60 hover:text-white transition-colors">
              <IoPaperPlaneOutline size={21} />
            </button>
          </div>
          <button
            onClick={toggleSave}
            className={`transition-all ${saved ? 'text-violet-400' : 'text-white/60 hover:text-white'}`}
          >
            {saved ? <IoBookmark size={21} /> : <IoBookmarkOutline size={21} />}
          </button>
        </div>

        {/* Counts */}
        {likesCount > 0 && (
          <p className="text-sm font-semibold text-white mb-1">{formatNumber(likesCount)} likes</p>
        )}

        {/* Caption */}
        {post.content && (
          <p className="text-sm text-white/80 leading-relaxed">
            <Link to={`/profile/${post.author.username}`} className="font-semibold text-white mr-1.5 hover:text-violet-400 transition-colors">
              {post.author.username}
            </Link>
            {post.content}
          </p>
        )}

        {/* Comments preview */}
        {post.comments_count > 0 && (
          <button
            onClick={() => setShowComments(true)}
            className="text-sm text-white/30 hover:text-white/60 transition-colors mt-1 block"
          >
            View all {post.comments_count} comments
          </button>
        )}
      </div>

      {/* Comments drawer */}
      <CommentsDrawer
        open={showComments}
        onClose={() => setShowComments(false)}
        post={post}
        onUpdate={onUpdate}
      />
    </motion.article>
  );
}

