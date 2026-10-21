import { useCallback } from 'react';
import { postsAPI } from '../api';
import { usePaginatedFeed, useIntersection } from '../hooks/index';
import PostCard from '../components/posts/PostCard';
import StoriesBar from '../components/stories/StoriesBar';
import RightPanel from '../components/layout/RightPanel';
import { PostSkeleton } from '../components/common/Loaders';
import { Spinner } from '../components/common/Loaders';

export default function HomePage() {
  const fetcher = useCallback((page) => postsAPI.feed(page), []);
  const { posts, loading, hasNext, loadMore, updatePost, removePost } = usePaginatedFeed(fetcher);

  const sentinelRef = useIntersection(() => {
    if (hasNext && !loading) loadMore();
  });

  return (
    <div className="flex justify-center gap-8 max-w-5xl mx-auto px-4 py-6">
      {/* Feed */}
      <div className="w-full max-w-[470px]">
        {/* Stories */}
        <div className="glass overflow-hidden mb-4">
          <StoriesBar />
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading && posts.length === 0 && (
            Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
          )}

          {!loading && posts.length === 0 && (
            <div className="text-center py-20 text-white/30">
              <p className="text-2xl mb-3">📭</p>
              <p className="font-medium">Your feed is empty</p>
              <p className="text-sm mt-1">Follow people to see their posts here</p>
            </div>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdate={(patch) => updatePost(post.id, patch)}
              onRemove={removePost}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="flex justify-center py-4">
            {loading && posts.length > 0 && <Spinner />}
          </div>
        </div>
      </div>

      {/* Right panel - desktop only */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <div className="sticky top-6">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}

