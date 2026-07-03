// Remove.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Remove from '../Remove';

vi.mock('../Getter', () => ({
  default: vi.fn(() =>
    Promise.resolve({ data: ['video1.mp4', 'video2.mp4'] })
  ),
}));

global.fetch = vi.fn();

describe('Remove Component', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────

  test('renders remove heading', () => {
    render(<MemoryRouter><Remove /></MemoryRouter>);
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  test('renders subheading', () => {
    render(<MemoryRouter><Remove /></MemoryRouter>);
    expect(
      screen.getByText(/permanently delete/i)
    ).toBeInTheDocument();
  });

  test('shows loading fallback initially', () => {
    render(<MemoryRouter><Remove /></MemoryRouter>);
    expect(screen.getByText(/loading files/i)).toBeInTheDocument();
  });

  test('renders file list after data resolves', async () => {
    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      expect(screen.getByText('video2.mp4')).toBeInTheDocument();
    });
  });

  test('renders a Remove button per file', async () => {
    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /remove/i });
      expect(buttons).toHaveLength(2);
    });
  });

  test('shows empty message when no files exist', async () => {
    const { default: getAll } = await import('../Getter');
    getAll.mockResolvedValueOnce({ data: [] });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/no files found/i)).toBeInTheDocument();
    });
  });

  // ── Interactions ──────────────────────────────────────────────────────

  test('calls DELETE /video/api/remove/{filename} on button click', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('File Removed Successfully!'),
    });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/video/api/remove/video1.mp4',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  test('shows Removing… while request is pending', async () => {
    global.fetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Removing…')).toBeInTheDocument();
    });
  });

  test('button is disabled while request is pending', async () => {
    global.fetch.mockReturnValue(new Promise(() => {}));

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    const btn = screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0];
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toBeDisabled());
  });

  test('shows success message after removal', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('File Removed Successfully!'),
    });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('File Removed Successfully!')).toBeInTheDocument();
    });
  });

  test('removes the file row from DOM after successful delete', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('File Removed Successfully!'),
    });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.queryByText('video1.mp4')).not.toBeInTheDocument();
    });
  });

  test('shows error message on fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/remove failed/i)).toBeInTheDocument();
    });
  });

  test('shows error message on non-ok HTTP response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('File Not Found'),
    });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('File Not Found')).toBeInTheDocument();
    });
  });

  test('other files remain visible after one is removed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('File Removed Successfully!'),
    });

    render(<MemoryRouter><Remove /></MemoryRouter>);
    await waitFor(() => screen.getByText('video1.mp4'));

    fireEvent.click(screen.getAllByRole('button', { name: /remove video1\.mp4/i })[0]);

    await waitFor(() => {
      expect(screen.queryByText('video1.mp4')).not.toBeInTheDocument();
      expect(screen.getByText('video2.mp4')).toBeInTheDocument();
    });
  });
});