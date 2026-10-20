import { describe, expect, it } from 'vitest'
import { formatBytes, kindOf, timeAgo } from './format'

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB')
  })

  it('rejects nonsense', () => {
    expect(formatBytes(-1)).toBe('–')
    expect(formatBytes('abc')).toBe('–')
    expect(formatBytes(undefined)).toBe('–')
  })
})

describe('kindOf', () => {
  it('classifies by extension, case-insensitively', () => {
    expect(kindOf('clip.MP4')).toBe('video')
    expect(kindOf('photo.jpeg')).toBe('image')
    expect(kindOf('song.flac')).toBe('audio')
    expect(kindOf('report.pdf')).toBe('doc')
    expect(kindOf('archive.zip')).toBe('other')
    expect(kindOf('noextension')).toBe('other')
    expect(kindOf()).toBe('other')
  })
})

describe('timeAgo', () => {
  const now = 1_000_000_000
  it('buckets durations', () => {
    expect(timeAgo(now - 10_000, now)).toBe('just now')
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 h ago')
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2 d ago')
  })
})
