// Thin client for the media backend (gateway maps /video/api/ to the Spring service).
export const API = '/video/api'

export const streamUrl = (name) => `${API}/stream/${encodeURIComponent(name)}`
export const downloadUrl = (name) => `${API}/download/${encodeURIComponent(name)}`

async function readError(res, fallback) {
  try {
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return data.error || data.message || fallback
    } catch {
      return text || fallback
    }
  } catch {
    return fallback
  }
}

export async function listMedia(headers = {}) {
  const res = await fetch(`${API}/media`, { headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not load the media library'))
  return res.json()
}

export async function recordView(name) {
  const res = await fetch(`${API}/media/${encodeURIComponent(name)}/view`, { method: 'POST' })
  return res.ok ? res.json() : null
}

export async function toggleLike(name, headers = {}) {
  const res = await fetch(`${API}/media/${encodeURIComponent(name)}/like`, { method: 'POST', headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not like this'))
  return res.json()
}

export async function claimEarnings(headers = {}) {
  const res = await fetch(`${API}/media/claim`, { method: 'POST', headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not claim earnings'))
  return res.json()
}

export async function removeMedia(name, headers = {}) {
  const res = await fetch(`${API}/remove/${encodeURIComponent(name)}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error(await readError(res, 'Could not remove the file'))
  return true
}

/** XHR (not fetch) so the browser reports upload progress. */
export function uploadMedia(file, headers = {}, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/upload`)
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      const text = xhr.responseText || ''
      if (xhr.status >= 200 && xhr.status < 300 && !text.startsWith('Error')) resolve(text)
      else if (xhr.status === 413) reject(new Error('File is too large for the server.'))
      else reject(new Error(text.replace(/^Error:\s*/, '') || `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Network error while uploading.'))
    const form = new FormData()
    form.append('fileToUpload', file)
    xhr.send(form)
  })
}
