import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimEarnings, downloadUrl, listMedia, removeMedia, streamUrl, toggleLike } from './api'

const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })
const fail = (status, body) => ({ ok: false, status, json: async () => body, text: async () => JSON.stringify(body) })

afterEach(() => vi.restoreAllMocks())

describe('urls', () => {
  it('encodes file names', () => {
    expect(streamUrl('my clip #1.mp4')).toBe('/video/api/stream/my%20clip%20%231.mp4')
    expect(downloadUrl('a b.png')).toBe('/video/api/download/a%20b.png')
  })
})

describe('listMedia', () => {
  it('sends identity headers and returns the library', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ files: [{ name: 'a.mp4' }], claimable: 0 }))
    vi.stubGlobal('fetch', fetchMock)
    const data = await listMedia({ Authorization: 'Bearer t' })
    expect(data.files).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/video/api/media', { headers: { Authorization: 'Bearer t' } })
  })

  it('throws a readable error on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(500, { error: 'boom' })))
    await expect(listMedia()).rejects.toThrow('boom')
  })
})

describe('actions', () => {
  it('like surfaces the server message when logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(401, { error: 'Log in to the city bank to like media.' })))
    await expect(toggleLike('a.mp4')).rejects.toThrow('Log in')
  })

  it('claim returns the server computed amount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ amount: 42 })))
    await expect(claimEarnings({})).resolves.toEqual({ amount: 42 })
  })

  it('remove uses DELETE and reports 403 text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'You can only delete your own uploads.' })
    vi.stubGlobal('fetch', fetchMock)
    await expect(removeMedia('a.mp4', {})).rejects.toThrow('your own uploads')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})
