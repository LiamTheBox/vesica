import { CHATTER, URGENT } from './lines'
import { personalityOf } from './personalities'

// The bladder's voice: which line it says when, through the browser's speech engine, and
// the subtitle for each line (shown with the voice off too). What it says, and how, is its
// personality's (personalities.js).

// Who gets to speak. Chatter used to share one 10 s cooldown with everything, so a poke, a
// leak or even a failure often went unsaid. Now urgent lines (a leak, a failure) cut in
// over anything; a reaction to what just happened cuts in over chatter, and if another
// reaction is being said it waits for it to end (briefly, or it's stale); the bladder's
// own chatter about how full it is waits its turn, `chatGap` seconds apart and after a
// quiet spell.
export const PRIORITY = { chatter: 0, reaction: 1, urgent: 2 }
const REPEAT_GAP = [0, 4, 1.5] // s before the same kind of line is said again, by priority
const QUIET_BEFORE_CHATTER = 6 // s after any line
const CHATTER_GAP_SCALE = { full: 0.75, critical: 0.5 } // a desperate bladder talks more
const WAIT = 4 // s a reaction waits for its turn
const SECONDS_PER_WORD = 0.38 // at rate 1, to estimate how long a line takes

// Picked automatically when the player hasn't chosen one: a voice whose name matches.
const PREFERRED = ['female', 'woman', 'samantha', 'victoria', 'karen', 'zira', 'susan', 'catherine', 'fiona', 'moira', 'tessa', 'ava', 'allison']

// The English voices, those on the device first: a network voice (like Chrome's "Google US
// English") goes silent offline. `localService` is missing in some browsers; those count
// as on the device.
export function englishVoices(voices) {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  return [...english.filter((v) => v.localService !== false), ...english.filter((v) => v.localService === false)]
}

// The voice named `name` if it's installed; otherwise the first preferred English voice
// on the device, then any on the device, then the network ones, then whatever there is.
export function pickVoice(voices, name = '') {
  const chosen = name && voices.find((v) => v.name === name)
  if (chosen) return chosen
  const english = englishVoices(voices)
  const preferred = english.find((v) => v.localService !== false && PREFERRED.some((k) => v.name.toLowerCase().includes(k)))
  return preferred ?? english[0] ?? voices[0] ?? null
}

export class Voice {
  constructor() {
    this.enabled = true
    this.muted = false // the master mute
    this.volume = 1.0
    this.voiceName = '' // the player's choice; '' picks one
    this.voice = null
    this.personality = 'dramatic'

    this.clock = 0 // s, advanced by update()
    this.chatGap = 30 // s between chatter lines (the Settings slider)
    this.busyUntil = 0 // the line being said ends about then...
    this.busyPriority = PRIORITY.chatter // ...and this is how much it matters
    this.lastLineAt = -Infinity
    this.lastChatterAt = -Infinity
    this.lastSaid = new Map() // category -> when
    this.pending = null // a reaction waiting for the line being said: { category, priority, until }
    this.utterance = null
    this.recentHistory = new Map()
    this.historySize = 5

    this.synth = typeof window !== 'undefined' ? window.speechSynthesis ?? null : null
    this.onSubtitle = null // (text, category, seconds) for the UI
    this.voiceListeners = new Set()

    this.loadVoices()
    // Browsers list their voices late, and again when one is installed.
    this.synth?.addEventListener?.('voiceschanged', () => this.loadVoices())
  }

  // The English voices to choose from, those on the device first.
  voices() {
    return this.synth ? englishVoices(this.synth.getVoices() ?? []) : []
  }

  loadVoices() {
    if (!this.synth) return
    const voices = this.synth.getVoices()
    if (voices?.length) this.voice = pickVoice(voices, this.voiceName)
    for (const listener of this.voiceListeners) listener()
  }

  // Calls `listener` whenever the list of voices changes; returns the unsubscribe.
  onVoicesChanged(listener) {
    this.voiceListeners.add(listener)
    return () => this.voiceListeners.delete(listener)
  }

  // Its lines change with it, so the record of recent ones starts over.
  setPersonality(key) {
    if (key === this.personality) return
    this.personality = key
    this.recentHistory.clear()
  }

  setVoiceName(name) {
    if (name === this.voiceName) return
    this.voiceName = name
    this.loadVoices()
  }

  // Says a short hello in the current voice and personality (after choosing them in Settings).
  sample() {
    if (!this.enabled || this.muted || !this.synth) return
    const who = personalityOf(this.personality)
    const style = who.styleOf('nominal')
    this.synth.cancel()
    const utterance = new SpeechSynthesisUtterance(who.sample)
    if (this.voice) utterance.voice = this.voice
    utterance.volume = this.volume * who.volume
    utterance.pitch = style.pitch
    utterance.rate = style.rate
    this.synth.speak(utterance)
  }

  // Stops the line being said (the voice was turned off).
  cancel() {
    this.synth?.cancel()
  }

  // In the background: drop the line being said and the one waiting.
  suspend() {
    this.synth?.cancel()
    this.busyUntil = this.clock
    this.pending = null
  }

  priorityOf(category) {
    return URGENT.has(category) ? PRIORITY.urgent : CHATTER.has(category) ? PRIORITY.chatter : PRIORITY.reaction
  }

  // Says a line of `category` if it's its turn (see PRIORITY), and shows it as a subtitle,
  // also with the voice off. Returns whether it was said.
  speak(category) {
    const who = personalityOf(this.personality)
    const list = who.lines[category]
    if (!list || list.length === 0) return false
    const priority = this.priorityOf(category)
    const now = this.clock
    const busy = now < this.busyUntil
    if (priority === PRIORITY.chatter) {
      const gap = this.chatGap * (CHATTER_GAP_SCALE[category] ?? 1)
      if (busy || this.synth?.speaking || now - this.lastLineAt < QUIET_BEFORE_CHATTER || now - this.lastChatterAt < gap) return false
    } else {
      if (now - (this.lastSaid.get(category) ?? -Infinity) < REPEAT_GAP[priority]) return false
      if (busy && priority < PRIORITY.urgent && priority <= this.busyPriority) {
        if (!this.pending || priority >= this.pending.priority) this.pending = { category, priority, until: now + WAIT }
        return false
      }
    }

    // Not one of the last few of this kind: up to `historySize`, and at most half the list,
    // so the choice never narrows to a fixed rotation.
    let recent = this.recentHistory.get(category) || []
    let available = list.map((_, i) => i).filter(i => !recent.includes(i))
    if (available.length === 0) available = list.map((_, i) => i)

    const chosenIndex = available[Math.floor(Math.random() * available.length)]
    recent.push(chosenIndex)
    while (recent.length > Math.min(this.historySize, Math.floor(list.length / 2))) recent.shift()
    this.recentHistory.set(category, recent)

    const text = list[chosenIndex]
    const style = who.styleOf(category)
    const seconds = 0.3 + (text.split(' ').length * SECONDS_PER_WORD) / style.rate
    this.busyUntil = now + seconds
    this.busyPriority = priority
    this.lastLineAt = now
    this.lastSaid.set(category, now)
    if (priority === PRIORITY.chatter) this.lastChatterAt = now
    if (this.pending && this.pending.priority <= priority) this.pending = null

    if (this.enabled && !this.muted && this.synth) {
      if (busy || this.synth.speaking) this.synth.cancel() // cut off the less important line
      const utterance = new SpeechSynthesisUtterance(text)
      if (this.voice) utterance.voice = this.voice
      utterance.volume = this.volume * who.volume
      utterance.pitch = style.pitch
      utterance.rate = style.rate
      // Busy until it really ends (slow voices outlast the estimate), up to twice the estimate.
      this.busyUntil = now + seconds * 2
      utterance.onend = utterance.onerror = () => {
        if (this.utterance === utterance) this.busyUntil = Math.min(this.busyUntil, this.clock)
      }
      this.utterance = utterance
      this.synth.speak(utterance)
    }
    if (this.onSubtitle) this.onSubtitle(text, category, seconds)
    return true
  }

  update(dt) {
    this.clock += dt
    // A waiting reaction gets its turn once the line before it ends.
    if (this.pending && this.clock >= this.busyUntil) {
      const { category, until } = this.pending
      this.pending = null
      if (this.clock <= until) this.speak(category)
    }
  }
}

export const voice = new Voice()
