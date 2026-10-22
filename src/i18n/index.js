import en from './en'

// The interface's words, looked up by key (A14). English is the only language for now (the
// player's choice); adding one means a translated copy of en.js in LANGUAGES, lines for each
// personality, the stories, and a voice that speaks it (audio/voice.js picks voices by
// LANGUAGE). Missing words fall back to English, then to the key itself.
const LANGUAGES = { en }
export const LANGUAGE = 'en'
const LOCALE = 'en-US' // for numbers
const words = LANGUAGES[LANGUAGE]
const plurals = new Intl.PluralRules(LOCALE)

// The words for `key`, with each {name} filled in from `values`.
export function t(key, values) {
  const text = words[key] ?? en[key] ?? key
  return values ? text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match)) : text
}

// The words for `key` that go with the count `n` (`key.one`, `key.other`, …), as {n}.
export function tCount(key, n, values) {
  const form = `${key}.${plurals.select(n)}`
  return t(form in words || form in en ? form : `${key}.other`, { n, ...values })
}

// 12345 -> "12,345"
export const formatNumber = (n) => n.toLocaleString(LOCALE)
