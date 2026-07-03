import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

// ── Module mocks ──────────────────────────────────────────────

vi.mock('../api/index', () => ({
  postsAPI: { feed: vi.fn() },
}));

vi.mock('../hooks/index', () => ({
  usePaginatedFeed: vi.fn(),
  useIntersection:  vi.fn(() => ({ current: null })),
}));

vi.mock('../components/posts/PostCard', () => ({
  default: ({ post }) => <div data-testid="post-card">{post.content}</div>,
}));

vi.mock('../components/stories/StoriesBar', () => ({
  default: () => <div data-testid="stories-bar" />,
}));

vi.mock('../components/layout/RightPanel', () => ({
  default: () => <div data-testid="right-panel" />,
}));

vi.mock('../components/common/Loaders', () => ({
  PostSkeleton: () => <div data-testid="post-skeleton" />,
  Spinner:      () => <span data-testid="spinner" />,
}));

import { usePaginatedFeed } from '../hooks/index';

const defaultFeedState = {
  posts:      [],
  loading:    false,
  hasNext:    false,
  loadMore:   vi.fn(),
  updatePost: vi.fn(),
  removePost: vi.fn(),
};

const renderPage = () =>
  render(<MemoryRouter><HomePage /></MemoryRouter>);

// ── Tests ─────────────────────────────────────────────────────

describe('HomePage', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders StoriesBar', () => {
    usePaginatedFeed.mockReturnValue(defaultFeedState);
    renderPage();
    expect(screen.getByTestId('stories-bar')).toBeInTheDocument();
  });

  test('shows empty-feed message when no posts and not loading', () => {
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts: [], loading: false });
    renderPage();
    expect(screen.getByText('Your feed is empty')).toBeInTheDocument();
    expect(screen.getByText('Follow people to see their posts here')).toBeInTheDocument();
  });

  test('shows skeletons while loading with no posts yet', () => {
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts: [], loading: true });
    renderPage();
    expect(screen.getAllByTestId('post-skeleton').length).toBe(3);
  });

  test('does not show empty message while loading', () => {
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts: [], loading: true });
    renderPage();
    expect(screen.queryByText('Your feed is empty')).not.toBeInTheDocument();
  });

  test('renders a PostCard for each post', () => {
    const posts = [
      { id: 1, content: 'First post' },
      { id: 2, content: 'Second post' },
    ];
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts });
    renderPage();
    expect(screen.getAllByTestId('post-card').length).toBe(2);
    expect(screen.getByText('First post')).toBeInTheDocument();
    expect(screen.getByText('Second post')).toBeInTheDocument();
  });

  test('shows spinner at bottom while loading more pages', () => {
    const posts = [{ id: 1, content: 'A post' }];
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts, loading: true });
    renderPage();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  test('does not show spinner when not loading', () => {
    const posts = [{ id: 1, content: 'A post' }];
    usePaginatedFeed.mockReturnValue({ ...defaultFeedState, posts, loading: false });
    renderPage();
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
  });
});