// ══════════════════════════════════════════════════════════════════════════════
// FILE 3  src/test/Library.test.jsx
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Library } from '../components/Library.jsx';


vi.mock('../scripts/Handler.js', () => ({
  getBooks: vi.fn(),
  summarizeBook: vi.fn(),
}));

import { getBooks, summarizeBook } from '../scripts/Handler.js';

const sampleBooks = [
  { id: 1, title: 'Dune', author: 'Frank Herbert', rating: 5, genre: 'Sci-Fi', description: 'Sand planet.' },
  { id: 2, title: 'Neuromancer', author: 'William Gibson', rating: 4, genre: 'Cyberpunk', description: 'Cyberspace.' },
];

// Stub global fetch for the recommendations endpoint.
global.fetch = vi.fn();

describe('Library component', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading state initially', () => {
    getBooks.mockReturnValueOnce(new Promise(() => {}));
    render(<Library />);
    expect(screen.getByText(/loading your library/i)).toBeInTheDocument();
  });

  it('renders book cards after loading', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    render(<Library />);

    await waitFor(() => expect(screen.getByText('Dune')).toBeInTheDocument());
    expect(screen.getByText('Neuromancer')).toBeInTheDocument();
    expect(screen.getByText('Frank Herbert')).toBeInTheDocument();
  });

  it('shows empty state when library has no books', async () => {
    getBooks.mockResolvedValueOnce([]);
    render(<Library />);

    await waitFor(() =>
      expect(screen.getByText(/no books yet/i)).toBeInTheDocument()
    );
  });

  it('shows error banner on fetch failure', async () => {
    getBooks.mockRejectedValueOnce(new Error('Network error'));
    render(<Library />);

    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
  });

  it('filters books by title search', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    render(<Library />);

    await waitFor(() => screen.getByText('Dune'));

    await userEvent.type(screen.getByPlaceholderText(/search by title/i), 'Neu');

    expect(screen.queryByText('Dune')).not.toBeInTheDocument();
    expect(screen.getByText('Neuromancer')).toBeInTheDocument();
  });

  it('filters books by author search (case-insensitive)', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    render(<Library />);

    await waitFor(() => screen.getByText('Dune'));

    await userEvent.type(screen.getByPlaceholderText(/search by title/i), 'frank');

    expect(screen.getByText('Dune')).toBeInTheDocument();
    expect(screen.queryByText('Neuromancer')).not.toBeInTheDocument();
  });

  it('shows "no results" message when search has no matches', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    render(<Library />);

    await waitFor(() => screen.getByText('Dune'));

    await userEvent.type(screen.getByPlaceholderText(/search by title/i), 'zzznomatch');

    expect(screen.getByText(/no results match/i)).toBeInTheDocument();
  });

  it('opens recommend modal on Recommend click', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recommendations: [] }),
    });

    render(<Library />);
    await waitFor(() => screen.getByText('Dune'));

    const recommendBtns = screen.getAllByRole('button', { name: /recommend/i });
    fireEvent.click(recommendBtns[0]);

    await waitFor(() =>
      expect(screen.getByText(/recommendations/i)).toBeInTheDocument()
    );
  });

  it('opens summary modal on Summarize click', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    summarizeBook.mockResolvedValueOnce({ summary: 'A long summary.' });

    render(<Library />);
    await waitFor(() => screen.getByText('Dune'));

    const summarizeBtns = screen.getAllByRole('button', { name: /summarize/i });
    fireEvent.click(summarizeBtns[0]);

    await waitFor(() =>
      expect(screen.getByText(/a long summary/i)).toBeInTheDocument()
    );
  });

  it('closes summary modal when ✕ is clicked', async () => {
    getBooks.mockResolvedValueOnce(sampleBooks);
    summarizeBook.mockResolvedValueOnce({ summary: 'Short summary.' });

    render(<Library />);
    await waitFor(() => screen.getByText('Dune'));

    fireEvent.click(screen.getAllByRole('button', { name: /summarize/i })[0]);
    await waitFor(() => screen.getByText(/short summary/i));

    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    await waitFor(() =>
      expect(screen.queryByText(/short summary/i)).not.toBeInTheDocument()
    );
  });
});