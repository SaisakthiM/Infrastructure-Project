// Homepage.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../HomePage';

describe('HomePage', () => {

  // ── Render ────────────────────────────────────────────────────────────

  test('renders file uploader heading', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('File Uploader')).toBeInTheDocument();
  });

  test('renders upload link text', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    // The link contains "Upload a file" plus a tag span; query the partial text
    expect(screen.getByText(/upload a file/i)).toBeInTheDocument();
  });

  test('renders download link text', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/download a file/i)).toBeInTheDocument();
  });

  test('renders remove link text', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/remove a file/i)).toBeInTheDocument();
  });

  // ── Navigation ────────────────────────────────────────────────────────

  test('upload link points to /upload', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /upload a file/i });
    expect(link).toHaveAttribute('href', '/upload');
  });

  test('download link points to /download', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /download a file/i });
    expect(link).toHaveAttribute('href', '/download');
  });

  test('remove link points to /remove', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /remove a file/i });
    expect(link).toHaveAttribute('href', '/remove');
  });

  // ── Tag badges ────────────────────────────────────────────────────────

  test('renders POST tag badge', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('POST')).toBeInTheDocument();
  });

  test('renders GET tag badge', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('GET')).toBeInTheDocument();
  });

  test('renders DEL tag badge', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText('DEL')).toBeInTheDocument();
  });

  // ── Footer note ───────────────────────────────────────────────────────

  test('renders the OMV backup note', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(/backed up to OMV/i)).toBeInTheDocument();
  });
});