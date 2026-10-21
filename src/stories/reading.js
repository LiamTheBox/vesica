import { loadJson, saveJson } from '../store/persist'

// Where the reader is, kept on the device: the chapter open (null for the list), how far
// down each chapter they got (0..1) and the text size (an index into TEXT_SIZES).
export const TEXT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl']
export const DEFAULT_READING = { chapter: null, places: {}, size: 1 }

export function loadReading() {
  const saved = loadJson('reading', DEFAULT_READING)
  const size = Number.isInteger(saved.size) ? Math.min(TEXT_SIZES.length - 1, Math.max(0, saved.size)) : DEFAULT_READING.size
  return { chapter: typeof saved.chapter === 'string' ? saved.chapter : null, places: { ...saved.places }, size }
}

export const saveReading = (reading) => saveJson('reading', reading)
