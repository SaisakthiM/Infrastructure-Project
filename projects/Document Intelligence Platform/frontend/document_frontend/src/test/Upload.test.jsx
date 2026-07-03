// ══════════════════════════════════════════════════════════════════════════════
// FILE 2  src/test/Upload.test.jsx
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Upload } from '../components/Upload.jsx';


// Stub Handler so the component doesn't make real HTTP calls.
vi.mock('../scripts/Handler.js', () => ({
  createBook: vi.fn(),
}));

import { createBook } from '../scripts/Handler.js';

describe('Upload component', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders title, author, description inputs and a submit button', () => {
    render(<Upload />);

    expect(screen.getByPlaceholderText(/atomic habits/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/james clear/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/short summary/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('shows success banner after successful upload', async () => {
    createBook.mockResolvedValueOnce({ id: 1 });

    render(<Upload />);
    await userEvent.type(screen.getByPlaceholderText(/atomic habits/i), 'My Book');
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() =>
      expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument(),
      { timeout: 600 }
    );
  });

  it('shows error banner on API failure', async () => {
    createBook.mockRejectedValueOnce(new Error('Server error'));

    render(<Upload />);
    await userEvent.type(screen.getByPlaceholderText(/atomic habits/i), 'Fail Book');
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() =>
      expect(screen.getByText(/server error/i)).toBeInTheDocument()
    );
  });

  it('disables the submit button while uploading', async () => {
    // Never resolves — keeps loading state active throughout assertion
    createBook.mockReturnValueOnce(new Promise(() => {}));

    render(<Upload />);
    await userEvent.type(screen.getByPlaceholderText(/atomic habits/i), 'Hang Book');
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled()
    );
  });

  it('resets form fields after a successful upload', async () => {
    createBook.mockResolvedValueOnce({ id: 2 });

    render(<Upload />);
    const titleInput = screen.getByPlaceholderText(/atomic habits/i);
    await userEvent.type(titleInput, 'Reset Book');
    fireEvent.click(screen.getByRole('button', { name: /upload document/i }));

    await waitFor(() => expect(titleInput.value).toBe(''));
  });

  it('clicking a star sets the rating', async () => {
    render(<Upload />);

    const stars = screen.getAllByText('★');
    // Click 3rd star
    fireEvent.click(stars[2]);
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
  });
});