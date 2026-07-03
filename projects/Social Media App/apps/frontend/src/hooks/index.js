import { useState, useCallback, useEffect, useRef } from 'react';
import { postsAPI, usersAPI } from '../api';
import { toast } from 'react-toastify';

// ── Paginated feed loader ────────────────────────────────────
export function usePaginatedFeed(fetcher) {
  const [posts, setPosts]       = useState([]);
  const [page, setPage]         = useState(1);
  const [hasNext, setHasNext]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await fetcher(p);
      if (p === 1) setPosts(data.results);
      else setPosts((prev) => [...prev, ...data.results]);
      setHasNext(data.has_next);
      setPage(p);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { load(1); }, [load]);

  const loadMore = () => { if (hasNext && !loading) load(page + 1); };

  const updatePost = (id, patch) =>
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));

  const removePost = (id) =>
    setPosts((prev) => prev.filter((p) => p.id !== id));

  return { posts, loading, error, hasNext, loadMore, updatePost, removePost, refresh: () => load(1) };
}

// ── Like toggle ──────────────────────────────────────────────
export function useLike(post, onUpdate) {
  const [liked, setLiked]   = useState(post.is_liked);
  const [count, setCount]   = useState(post.likes_count);
  const pending             = useRef(false);

  const toggle = async () => {
    if (pending.current) return;
    pending.current = true;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => nextLiked ? c + 1 : c - 1);
    try {
      const { data } = await postsAPI.like(post.id);
      setLiked(data.liked);
      setCount(data.likes_count);
      onUpdate?.({ is_liked: data.liked, likes_count: data.likes_count });
    } catch {
      setLiked(!nextLiked);
      setCount((c) => nextLiked ? c - 1 : c + 1);
    } finally {
      pending.current = false;
    }
  };

  return { liked, count, toggle };
}

// ── Save toggle ──────────────────────────────────────────────
export function useSave(post, onUpdate) {
  const [saved, setSaved] = useState(post.is_saved);
  const toggle = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await postsAPI.save(post.id);
      onUpdate?.({ is_saved: next });
    } catch {
      setSaved(!next);
    }
  };
  return { saved, toggle };
}

// ── Follow toggle ─────────────────────────────────────────────
export function useFollow(username, initialFollowing) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading]     = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data } = await usersAPI.follow(username);
      setFollowing(data.following);
    } catch {
      toast.error('Failed to update follow status');
    } finally {
      setLoading(false);
    }
  };

  return { following, loading, toggle };
}

// ── Intersection Observer (infinite scroll) ──────────────────
export function useIntersection(callback, options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) callback();
    }, { threshold: 0.1, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, [callback]);
  return ref;
}

