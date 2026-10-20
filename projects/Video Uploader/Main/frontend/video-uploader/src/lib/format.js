// Small pure helpers (unit tested in format.test.js)

export function formatBytes(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return '–'
  if (v < 1024) return `${v} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = v / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`
}

const EXT = {
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'ogv'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
  doc: ['pdf', 'txt', 'md', 'doc', 'docx', 'csv'],
}

// mirrors MediaController.kindOf on the backend
export function kindOf(name = '') {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  return Object.keys(EXT).find((k) => EXT[k].includes(ext)) || 'other'
}

export const KIND_ICON = { video: '🎬', image: '🖼️', audio: '🎵', doc: '📄', other: '📦' }

export function timeAgo(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
