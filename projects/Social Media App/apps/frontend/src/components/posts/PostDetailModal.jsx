import { useState } from 'react';
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

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col md:flex-row"
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media */}
          {post.media?.[0] && (
            <div className="md:w-1/2 bg-black flex items-center">
              <img src={post.media[0].file} alt="" className="w-full object-contain max-h-[70vh]" />
            </div>
          )}

          {/* Info */}
          <div className={`flex flex-col ${post.media?.[0] ? 'md:w-1/2' : 'w-full'} min-h-0`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
              <Link to={`/profile/${post.author.username}`} onClick={onClose} className="flex items-center gap-2.5">
                <Avatar user={post.author} size="sm" />
                <span className="text-sm font-semibold">{post.author.profile_name || post.author.username}</span>
              </Link>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <IoClose size={20} />
              </button>
            </div>

            {/* Caption */}
            {post.content && (
              <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
                <p className="text-sm text-white/80 leading-relaxed">
                  <span className="font-semibold text-white mr-1.5">{post.author.username}</span>
                  {post.content}
                </p>
                <p className="text-xs text-white/30 mt-2">{timeAgo(post.created_at)}</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-white/5 mt-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-4">
                  <button onClick={toggle} className={`transition-all ${liked ? 'text-red-500' : 'text-white/60 hover:text-white'}`}>
                    {liked ? <IoHeart size={22} /> : <IoHeartOutline size={22} />}
                  </button>
                  <button onClick={() => setShowComments(true)} className="text-white/60 hover:text-white transition-colors">
                    <IoChatbubbleOutline size={21} />
                  </button>
                </div>
                <button onClick={toggleSave} className={`transition-all ${saved ? 'text-violet-400' : 'text-white/60 hover:text-white'}`}>
                  {saved ? <IoBookmark size={21} /> : <IoBookmarkOutline size={21} />}
                </button>
              </div>
              {count > 0 && <p className="text-sm font-semibold">{formatNumber(count)} likes</p>}
              {post.comments_count > 0 && (
                <button onClick={() => setShowComments(true)} className="text-xs text-white/30 hover:text-white/60 mt-0.5">
                  View all {post.comments_count} comments
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      <CommentsDrawer open={showComments} onClose={() => setShowComments(false)} post={post} onUpdate={update} />
    </>
  );
}

