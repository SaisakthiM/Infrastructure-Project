// Download.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Download from '../Downlaod';   // note: filename typo in repo

vi.mock('../Getter', () => ({
  default: vi.fn(() => Promise.resolve({ data: ['video1.mp4', 'video2.mp4'] })),
}));

describe('Download Component', () => {

  // ── Render ────────────────────────────────────────────────────────────

  test('renders download heading', () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  test('renders subheading', () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    expect(screen.getByText(/files available on the server/i)).toBeInTheDocument();
  });

  test('shows loading fallback initially', () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    expect(screen.getByText(/loading files/i)).toBeInTheDocument();
  });

  // ── File list ─────────────────────────────────────────────────────────

  test('renders file names after data resolves', async () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      expect(screen.getByText('video2.mp4')).toBeInTheDocument();
    });
  });

  test('download links have correct href', async () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    await waitFor(() => {
      const link = screen.getByText('video1.mp4').closest('a');
      expect(link).toHaveAttribute('href', '/video/api/download/video1.mp4');
    });
  });

  test('download links have download attribute', async () => {
    render(<MemoryRouter><Download /></MemoryRouter>);
    await waitFor(() => {
      const link = screen.getByText('video1.mp4').closest('a');
      expect(link).toHaveAttribute('download', 'video1.mp4');
    });
  });

  test('shows empty message when server returns no files', async () => {
    const { default: getAll } = await import('../Getter');
    getAll.mockResolvedValueOnce({ data: [] });

    render(<MemoryRouter><Download /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/no files found/i)).toBeInTheDocument();
    });
  });
});