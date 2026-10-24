import { useCallback, useState } from 'react';
import { postsAPI } from '../api';
import { usePaginatedFeed, useIntersection } from '../hooks';
import { Spinner, PostSkeleton } from '../components/common/Loaders';
import { motion, AnimatePresence } from 'framer-motion';
import { IoExpand, IoHeartOutline, IoChatbubbleOutline } from 'react-icons/io5';
import { formatNumber } from '../utils';
import PostDetailModal from '../components/posts/PostDetailModal';

export default function ExplorePage() {
  const fetcher = useCallback((page) => postsAPI.explore(page), []);
  const { posts, loading, hasNext, loadMore } = usePaginatedFeed(fetcher);
  const [selected, setSelected] = useState(null);

  const sentinelRef = useIntersection(() => {
    if (hasNext && !loading) loadMore();
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="display mb-6">Explore</h1>

      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square bg-zinc-950/5 rounded animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 text-zinc-500">
          <p className="text-2xl mb-3">🔭</p>
          <p className="font-medium">Nothing to explore yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 md:gap-1">
          {posts.map((post, i) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: (i % 9) * 0.04 }}
              onClick={() => setSelected(post)}
              className="relative aspect-square group overflow-hidden bg-city-raised"
            >
              {post.media?.[0] ? (
                <img
                  src={post.media[0].file}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-3">
                  <p className="text-zinc-600 text-xs line-clamp-4 text-left">{post.content}</p>
                </div>
              )}
              {/* Hover overlay — the one dark wash on this page: it sits over the media, not the page */}
              <div className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-5">
                <span className="flex items-center gap-1.5 text-city-on-accent font-semibold text-sm">
                  <IoHeartOutline size={18} /> {formatNumber(post.likes_count)}
                </span>
                <span className="flex items-center gap-1.5 text-city-on-accent font-semibold text-sm">
                  <IoChatbubbleOutline size={16} /> {formatNumber(post.comments_count)}
                </span>
              </div>
              {/* Multi-media indicator */}
              {post.media?.length > 1 && (
                <div className="absolute top-2 right-2">
                  <IoExpand size={14} className="text-city-on-accent drop-shadow" />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex justify-center py-6">
        {loading && posts.length > 0 && <Spinner />}
      </div>

      {/* Post detail modal */}
      <AnimatePresence>
        {selected && (
          <PostDetailModal post={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

