import { describe, test, expect, vi, beforeEach } from 'vitest';
import { formatNumber, getInitials, formatDate } from './index';

// ── formatNumber ─────────────────────────────────────────────

describe('formatNumber', () => {
  test('returns plain string for numbers under 1000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
  });

  test('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  test('formats millions with M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});

// ── getInitials ───────────────────────────────────────────────

describe('getInitials', () => {
  test('returns first letter of a single word', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  test('returns first letters of first two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  test('caps at two characters even for longer names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB');
  });

  test('returns uppercase', () => {
    expect(getInitials('alice doe')).toBe('AD');
  });

  test('handles empty string gracefully', () => {
    expect(getInitials('')).toBe('');
  });

  test('uses fallback when called with no arg', () => {
    expect(getInitials()).toBe('');
  });
});

// ── formatDate ────────────────────────────────────────────────

describe('formatDate', () => {
  test('formats a known date correctly', () => {
    // Use a fixed UTC timestamp to avoid timezone surprises
    const result = formatDate('2024-06-15T00:00:00.000Z');
    // Accepts Jun 15, 2024 regardless of local tz padding
    expect(result).toMatch(/Jun 1[45], 2024/);
  });
});