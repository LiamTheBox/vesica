// Small localStorage wrapper. Storage can be missing or throw (private mode, blocked
// site data), so every access is guarded and the game works without it.

const PREFIX = 'vesica.'

export function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Not persisted this time; the in-memory value still works.
  }
}
