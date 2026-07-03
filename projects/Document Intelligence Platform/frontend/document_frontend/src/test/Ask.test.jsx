// ══════════════════════════════════════════════════════════════════════════════
// FILE 4  src/test/Ask.test.jsx
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Ask } from '../components/Ask.jsx';


vi.mock('../scripts/Handler.js', () => ({
  getBooks: vi.fn(),
}));

import { getBooks } from '../scripts/Handler.js';

const books = [
  { id: 1, title: 'Sapiens', author: 'Yuval Noah Harari', rating: 4 },
  { id: 2, title: 'Cosmos', author: 'Carl Sagan', rating: 5 },
];

// Stub fetch for the /ask/ endpoint
global.fetch = vi.fn();

describe('Ask component', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading while books are fetched', () => {
    getBooks.mockReturnValueOnce(new Promise(() => {}));
    render(<Ask />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders sidebar with book list', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => expect(screen.getByText('Sapiens')).toBeInTheDocument());
    expect(screen.getByText('Cosmos')).toBeInTheDocument();
  });

  it('shows empty-state prompt when no book is selected', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => screen.getByText('Sapiens'));
    expect(screen.getByText(/pick a book/i)).toBeInTheDocument();
  });

  it('selects a book and shows welcome message', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    expect(screen.getByText((content) => content.includes("You're now asking about"))).toBeInTheDocument();
    expect(screen.getByText(/what would you like to know/i)).toBeInTheDocument();
  });

  it('sends question and shows AI response', async () => {
    getBooks.mockResolvedValueOnce(books);
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ answer: 'Humanity is old.' }),
    });

    render(<Ask />);
    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    const textarea = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(textarea, 'When did humans appear?');
    fireEvent.click(screen.getByRole('button', { name: '↑' }));

    await waitFor(() =>
      expect(screen.getByText('Humanity is old.')).toBeInTheDocument(),
      { timeout: 600 }
    );
  });

  it('shows error bubble on API failure', async () => {
    getBooks.mockResolvedValueOnce(books);
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Service unavailable' }),
    });

    render(<Ask />);
    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    await userEvent.type(screen.getByPlaceholderText(/ask anything/i), 'Question?');
    fireEvent.click(screen.getByRole('button', { name: '↑' }));

    await waitFor(() =>
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument()
    );
  });

  it('disables send button when input is empty', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    expect(screen.getByRole('button', { name: '↑' })).toBeDisabled();
  });

  it('sends question on Enter key (not Shift+Enter)', async () => {
    getBooks.mockResolvedValueOnce(books);
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ answer: 'Answer via enter.' }),
    });

    render(<Ask />);
    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    const textarea = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(textarea, 'Enter question{Enter}');

    await waitFor(() =>
      expect(screen.getByText('Answer via enter.')).toBeInTheDocument()
    );
  });

  it('does not send on Shift+Enter', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    const textarea = screen.getByPlaceholderText(/ask anything/i);
    await userEvent.type(textarea, 'Draft{shift>}{Enter}{/shift}');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resets book selection when Change is clicked', async () => {
    getBooks.mockResolvedValueOnce(books);
    render(<Ask />);

    await waitFor(() => screen.getByText('Sapiens'));
    fireEvent.click(screen.getByText('Sapiens'));

    fireEvent.click(screen.getByRole('button', { name: /change/i }));

    expect(screen.getByText(/pick a book/i)).toBeInTheDocument();
  });

  it('shows "No books uploaded yet" when library is empty', async () => {
    getBooks.mockResolvedValueOnce([]);
    render(<Ask />);

    await waitFor(() =>
      expect(screen.getByText(/no books uploaded yet/i)).toBeInTheDocument()
    );
  });
});