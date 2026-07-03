import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PostCard from '../../components/posts/PostCard';

// ── Module mocks ──────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'owner' } }),
}));

vi.mock('../../api', () => ({
  postsAPI: {
    like:   vi.fn(),
    save:   vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('framer-motion', () => ({
  motion: {
    article: ({ children, ...props }) => <article {...props}>{children}</article>,
    div:     ({ children, ...props }) => <div     {...props}>{children}</div>,
    span:    ({ children, ...props }) => <span    {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

vi.mock('../../components/posts/CommentsDrawer', () => ({
  default: ({ open }) => open ? <div data-testid="comments-drawer" /> : null,
}));

vi.mock('../../hooks', () => ({
  useLike: (post) => ({
    liked: post.is_liked,
    count: post.likes_count,
    toggle: vi.fn(),
  }),
  useSave: (post) => ({
    saved: post.is_saved,
    toggle: vi.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────

const basePost = {
  id: 101,
  author: { id: 1, username: 'owner', profile_name: 'Post Owner', profile_picture: null },
  content: 'Hello world post',
  media: [],
  likes_count: 5,
  is_liked: false,
  is_saved: false,
  comments_count: 3,
  created_at: new Date().toISOString(),
};

const otherPost = {
  ...basePost,
  id: 102,
  author: { id: 99, username: 'stranger', profile_name: 'Other User', profile_picture: null },
};

const renderCard = (post = basePost, props = {}) =>
  render(
    <MemoryRouter>
      <PostCard post={post} onUpdate={vi.fn()} onRemove={vi.fn()} {...props} />
    </MemoryRouter>
  );

// ── Tests ─────────────────────────────────────────────────────

describe('PostCard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Rendering ────────────────────────────────────────────

  

  test('renders post content', () => {
    renderCard();
    expect(screen.getByText('Hello world post')).toBeInTheDocument();
  });

  test('renders like count when > 0', () => {
    renderCard();
    expect(screen.getByText('5 likes')).toBeInTheDocument();
  });

  test('does not render like count when 0', () => {
    renderCard({ ...basePost, likes_count: 0 });
    expect(screen.queryByText(/likes/)).not.toBeInTheDocument();
  });

  test('renders "View all N comments" link when comments_count > 0', () => {
    renderCard();
    expect(screen.getByText('View all 3 comments')).toBeInTheDocument();
  });

  test('does not render comments link when comments_count is 0', () => {
    renderCard({ ...basePost, comments_count: 0 });
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  

  test('does not render img when media array is empty', () => {
    renderCard();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // ── Owner-only delete menu ────────────────────────────────

  

  test('does not show delete menu for non-owner', () => {
    renderCard(otherPost);
    // There should be no delete button at all
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  test('shows delete option after clicking ellipsis', () => {
    renderCard(basePost);
    // The ellipsis button is the one with IoEllipsisHorizontal — get by its container role
    const buttons = screen.getAllByRole('button');
    // First button in the header area opens the menu
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  // ── Comments drawer ───────────────────────────────────────

  test('opens comments drawer when "View all comments" is clicked', () => {
    renderCard();
    expect(screen.queryByTestId('comments-drawer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('View all 3 comments'));
    expect(screen.getByTestId('comments-drawer')).toBeInTheDocument();
  });
});