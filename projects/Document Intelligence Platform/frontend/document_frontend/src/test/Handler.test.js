import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBooks, createBook, getBook, deleteBook, summarizeBook, getRecommendations } from '../scripts/Handler.js';

const BASE_URL = '/document/api';

// Helper: build a mock fetch that resolves with the given body / status.
function mockFetch(body, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('Handler.js – API helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  // ── getBooks ───────────────────────────────────────────────────────────────

  describe('getBooks', () => {
    it('GETs /books/ and returns the response body', async () => {
      const books = [{ id: 1, title: 'Dune' }];
      global.fetch = mockFetch(books);

      const result = await getBooks();

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/`,
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(result).toEqual(books);
    });

    it('throws on non-ok response with server error message', async () => {
      global.fetch = mockFetch({ error: 'Forbidden' }, 403);

      await expect(getBooks()).rejects.toThrow('Forbidden');
    });

    it('throws with generic message when error field is absent', async () => {
      global.fetch = mockFetch({}, 500);

      await expect(getBooks()).rejects.toThrow('Request failed: 500');
    });
  });

  // ── getBook ────────────────────────────────────────────────────────────────

  describe('getBook', () => {
    it('GETs /books/:id/', async () => {
      const book = { id: 42, title: '1984' };
      global.fetch = mockFetch(book);

      const result = await getBook(42);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/42/`,
        expect.any(Object)
      );
      expect(result).toEqual(book);
    });
  });

  // ── deleteBook ─────────────────────────────────────────────────────────────

  describe('deleteBook', () => {
    it('sends DELETE to /books/:id/', async () => {
      global.fetch = mockFetch({ deleted: true });

      await deleteBook(7);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/7/`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ── summarizeBook ──────────────────────────────────────────────────────────

  describe('summarizeBook', () => {
    it('POSTs to /books/:id/summarize/ with default model', async () => {
      global.fetch = mockFetch({ summary: 'A book about a lot of things.' });

      const result = await summarizeBook(3);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/3/summarize/`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ model: 'gemini' }),
        })
      );
      expect(result.summary).toBe('A book about a lot of things.');
    });
  });

  // ── getRecommendations ─────────────────────────────────────────────────────

  describe('getRecommendations', () => {
    it('GETs /books/:id/recommendations/', async () => {
      global.fetch = mockFetch({ recommendations: [] });

      const result = await getRecommendations(5);

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/5/recommendations/`,
        expect.any(Object)
      );
      expect(result).toHaveProperty('recommendations');
    });
  });

  // ── createBook ─────────────────────────────────────────────────────────────

  describe('createBook', () => {
    it('POSTs FormData to /books/ with required fields', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 99, title: 'Brave New World' }),
      });

      const result = await createBook({
        title: 'Brave New World',
        author: 'Aldous Huxley',
        rating: 5,
        description: 'Dystopian classic.',
      });

      expect(fetch).toHaveBeenCalledWith(
        `${BASE_URL}/books/`,
        expect.objectContaining({ method: 'POST' })
      );
      // Verify FormData was passed (not JSON)
      const [, options] = fetch.mock.calls[0];
      expect(options.body).toBeInstanceOf(FormData);
      expect(result.id).toBe(99);
    });

    it('throws on upload failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'File too large' }),
      });

      await expect(
        createBook({ title: 'Big Book', author: null, rating: 0, description: '' })
      ).rejects.toThrow('File too large');
    });

    it('omits optional fields from FormData when null/undefined', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      await createBook({ title: 'Minimal', author: null, rating: 0, description: '' });

      const [, options] = fetch.mock.calls[0];
      const fd = options.body;
      // author not appended when null
      expect(fd.get('author')).toBeNull();
    });
  });
});