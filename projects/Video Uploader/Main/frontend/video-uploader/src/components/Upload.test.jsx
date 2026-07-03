// Upload.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Upload from '../Upload';

global.fetch = vi.fn();

describe('Upload Component', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Render ────────────────────────────────────────────────────────────

  test('renders upload heading', () => {
    render(<Upload />);
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  test('renders upload zone label', () => {
    render(<Upload />);
    expect(screen.getByText('Click to select a file')).toBeInTheDocument();
  });

  test('renders Upload File button', () => {
    render(<Upload />);
    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
  });

  test('file input is present in upload zone', () => {
    render(<Upload />);
    expect(document.querySelector('#image-upload')).toBeInTheDocument();
  });

  test('shows "No file selected" when no file chosen', () => {
    render(<Upload />);
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  test('submit button is disabled initially (no file selected)', () => {
    render(<Upload />);
    expect(screen.getByRole('button', { name: /upload file/i })).toBeDisabled();
  });

  // ── File selection ────────────────────────────────────────────────────

  test('shows file name after file is selected', () => {
    render(<Upload />);
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  test('submit button becomes enabled after file is selected', () => {
    render(<Upload />);
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    expect(screen.getByRole('button', { name: /upload file/i })).not.toBeDisabled();
  });

  // ── Uploading state ───────────────────────────────────────────────────

  test('shows "Uploading…" while request is pending', async () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<Upload />);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });

  test('submit button is disabled while uploading', async () => {
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<Upload />);

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled();
    });
  });

  // ── Success / error ───────────────────────────────────────────────────

  test('shows success message after upload', async () => {
    global.fetch.mockResolvedValue({
      text: () => Promise.resolve('File Uploaded Successfully!'),
    });

    render(<Upload />);
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      expect(screen.getByText('File Uploaded Successfully!')).toBeInTheDocument();
    });
  });

  test('success status div has "success" class', async () => {
    global.fetch.mockResolvedValue({
      text: () => Promise.resolve('File Uploaded Successfully!'),
    });

    render(<Upload />);
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      const statusEl = screen.getByText('File Uploaded Successfully!');
      expect(statusEl).toHaveClass('success');
    });
  });

  test('shows error message when upload fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<Upload />);
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });

  test('error status div has "error" class', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<Upload />);
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      const statusEl = screen.getByText(/Upload failed/);
      expect(statusEl).toHaveClass('error');
    });
  });

  test('POSTs to /video/api/upload', async () => {
    global.fetch.mockResolvedValue({
      text: () => Promise.resolve('File Uploaded Successfully!'),
    });

    render(<Upload />);
    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('#image-upload'), {
      target: { files: [file] },
    });
    fireEvent.submit(document.querySelector('#form'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/video/api/upload',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});