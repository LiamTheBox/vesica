import { CHATTER, LINES, NORMAL_VOICE, URGENT, VOICE_STYLE } from './lines'

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

// Short arcade cues: [frequency Hz, start s, length s, wave, volume] per note.
const CUES = {
  warning: [[660, 0, 0.09, 'triangle', 0.14], [880, 0.1, 0.09, 'triangle', 0.14]],
  perfect: [[784, 0, 0.08, 'sine', 0.16], [1175, 0.07, 0.16, 'sine', 0.16]],
  good: [[587, 0, 0.12, 'sine', 0.14]],
  miss: [[170, 0, 0.2, 'sawtooth', 0.07]],
  alarm: [[440, 0, 0.07, 'square', 0.06], [440, 0.12, 0.07, 'square', 0.06]],
  level: [[523, 0, 0.08, 'sine', 0.14], [659, 0.08, 0.08, 'sine', 0.14], [784, 0.16, 0.16, 'sine', 0.14]],
  bank: [[523, 0, 0.1, 'sine', 0.16], [784, 0.1, 0.1, 'sine', 0.16], [1047, 0.2, 0.28, 'sine', 0.16]],
}

export class AudioManager {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.sfxGain = null
    this.isMasterMuted = false
    this.sfxEnabled = true
    this.voiceEnabled = true
    this.sfxVolume = 0.8
    this.voiceVolume = 1.0

    this.dynamicJet = null
    this.clenchHumNode = null
    this.urgeRumbleNode = null
    this.creakCooldown = 0

    this.femaleVoice = null
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

    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    this.onSubtitle = null // Callback for React UI

    this.loadVoices()
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices()
    }
  }

  initCtx() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(this.isMasterMuted ? 0 : 1.0, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? this.sfxVolume : 0, this.ctx.currentTime)
      this.sfxGain.connect(this.masterGain)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  // In the background: silence the engine and drop the voice line.
  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend()
    this.synth?.cancel()
    this.busyUntil = this.clock
    this.pending = null
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  loadVoices() {
    if (!this.synth) return
    const voices = this.synth.getVoices()
    if (!voices || voices.length === 0) return
    const femaleKeywords = ['female', 'woman', 'samantha', 'victoria', 'karen', 'zira', 'susan', 'catherine', 'fiona', 'moira', 'tessa', 'ava', 'allison', 'google us english']
    for (const v of voices) {
      if (femaleKeywords.some(k => v.name.toLowerCase().includes(k))) {
        this.femaleVoice = v
        break
      }
    }
    if (!this.femaleVoice && voices.length > 0) this.femaleVoice = voices.find(v => v.lang.startsWith('en')) || voices[0]
  }

  priorityOf(category) {
    return URGENT.has(category) ? PRIORITY.urgent : CHATTER.has(category) ? PRIORITY.chatter : PRIORITY.reaction
  }

  // Says a line of `category` if it's its turn (see PRIORITY), and shows it as a subtitle,
  // also with the voice off. Returns whether it was said.
  speak(category) {
    const list = LINES[category]
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

    let recent = this.recentHistory.get(category) || []
    let available = list.map((_, i) => i).filter(i => !recent.includes(i))
    if (available.length === 0) available = list.map((_, i) => i)

    const chosenIndex = available[Math.floor(Math.random() * available.length)]
    recent.push(chosenIndex)
    if (recent.length > this.historySize) recent.shift()
    this.recentHistory.set(category, recent)

    const text = list[chosenIndex]
    const style = VOICE_STYLE[category] ?? NORMAL_VOICE
    const seconds = 0.3 + (text.split(' ').length * SECONDS_PER_WORD) / style.rate
    this.busyUntil = now + seconds
    this.busyPriority = priority
    this.lastLineAt = now
    this.lastSaid.set(category, now)
    if (priority === PRIORITY.chatter) this.lastChatterAt = now
    if (this.pending && this.pending.priority <= priority) this.pending = null

    if (this.voiceEnabled && !this.isMasterMuted && this.synth) {
      if (busy || this.synth.speaking) this.synth.cancel() // cut off the less important line
      const utterance = new SpeechSynthesisUtterance(text)
      if (this.femaleVoice) utterance.voice = this.femaleVoice
      utterance.volume = this.voiceVolume
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
    if (this.onSubtitle) this.onSubtitle(text, category)
    return true
  }

  startDynamicJet() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx()
    if (this.dynamicJet) return

    const bufferSize = this.ctx.sampleRate * 2
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99 * b0 + white * 0.055
      b1 = 0.96 * b1 + white * 0.085
      b2 = 0.88 * b2 + white * 0.16
      data[i] = (b0 + b1 + b2) * 0.22
    }

    const source = this.ctx.createBufferSource()
    source.buffer = noiseBuffer; source.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(500, this.ctx.currentTime)
    filter.Q.setValueAtTime(2.5, this.ctx.currentTime)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.15)

    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain)
    source.start()
    this.dynamicJet = { source, filter, gain }
  }

  updateDynamicJet(flowRate, pressure) {
    if (!this.dynamicJet || !this.ctx) return
    const now = this.ctx.currentTime
    this.dynamicJet.filter.frequency.setTargetAtTime(Math.min(2200, 400 + (flowRate * 38) + (pressure * 10)), now, 0.05)
    this.dynamicJet.gain.gain.setTargetAtTime(Math.min(0.38, 0.05 + (flowRate / 20.0) * 0.3), now, 0.05)
  }

  stopDynamicJet() {
    if (!this.dynamicJet) return
    const jet = this.dynamicJet; const now = this.ctx.currentTime
    jet.gain.gain.linearRampToValueAtTime(0.001, now + 0.12)
    setTimeout(() => { try { jet.source.stop() } catch{} jet.source.disconnect(); jet.gain.disconnect(); if (this.dynamicJet === jet) this.dynamicJet = null }, 130)
  }

  playGranularSlosh(magnitude) {
    if (!this.sfxEnabled || this.isMasterMuted || magnitude < 0.15) return
    this.initCtx()
    const now = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * 0.22
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI)
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(220 + magnitude * 300, now); filter.Q.setValueAtTime(2.0, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(Math.min(0.2, magnitude * 0.08), now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    src.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); src.start(now)
  }

  playSqueezeFM(amount) {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx()
    const now = this.ctx.currentTime
    const carrier = this.ctx.createOscillator(); const modulator = this.ctx.createOscillator()
    const modGain = this.ctx.createGain(); const outGain = this.ctx.createGain()
    carrier.type = 'triangle'; carrier.frequency.setValueAtTime(80 + amount * 40, now); carrier.frequency.exponentialRampToValueAtTime(35, now + 0.18)
    modulator.type = 'sine'; modulator.frequency.setValueAtTime(240, now); modGain.gain.setValueAtTime(amount * 90, now)
    modulator.connect(modGain); modGain.connect(carrier.frequency)
    outGain.gain.setValueAtTime(0.25 * amount, now); outGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    carrier.connect(outGain); outGain.connect(this.sfxGain)
    modulator.start(now); carrier.start(now); modulator.stop(now + 0.19); carrier.stop(now + 0.19)
  }

  playTensionCreak() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(2800 + Math.random() * 800, now); osc.frequency.linearRampToValueAtTime(1400, now + 0.06)
    gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    osc.connect(gain); gain.connect(this.sfxGain); osc.start(now); osc.stop(now + 0.065)
  }

  // `volume` scales it, `pan` places it left (-1) to right (1).
  playUreterSquirt(volume = 1, pan = 0) {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator(); const filter = this.ctx.createBiquadFilter(); const gain = this.ctx.createGain()
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.14)
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(350, now); filter.frequency.linearRampToValueAtTime(950, now + 0.12); filter.Q.setValueAtTime(4.0, now)
    gain.gain.setValueAtTime(0.18 * volume, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(filter); filter.connect(gain)
    if (pan && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner(); panner.pan.setValueAtTime(pan, now)
      gain.connect(panner); panner.connect(this.sfxGain)
    } else {
      gain.connect(this.sfxGain)
    }
    osc.start(now); osc.stop(now + 0.15)
  }

  startClenchHum() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); if (this.clenchHumNode) return
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(65, this.ctx.currentTime)
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.1)
    osc.connect(gain); gain.connect(this.sfxGain); osc.start()
    this.clenchHumNode = { osc, gain }
  }

  updateClenchHum(staminaRatio) {
    if (!this.clenchHumNode || !this.ctx) return
    this.clenchHumNode.osc.frequency.setTargetAtTime(65 + (1.0 - staminaRatio) * 55, this.ctx.currentTime, 0.05)
  }

  stopClenchHum() {
    if (!this.clenchHumNode) return
    const node = this.clenchHumNode; const now = this.ctx.currentTime
    node.gain.gain.linearRampToValueAtTime(0.001, now + 0.08)
    setTimeout(() => { try { node.osc.stop() } catch{} node.osc.disconnect(); node.gain.disconnect(); if (this.clenchHumNode === node) this.clenchHumNode = null }, 90)
  }

  startUrgeRumble() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); if (this.urgeRumbleNode) return
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
    osc.type = 'triangle'; osc.frequency.setValueAtTime(36, this.ctx.currentTime)
    gain.gain.setValueAtTime(0.01, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.4)
    osc.connect(gain); gain.connect(this.sfxGain); osc.start()
    this.urgeRumbleNode = { osc, gain }
  }

  stopUrgeRumble() {
    if (!this.urgeRumbleNode) return
    const node = this.urgeRumbleNode; const now = this.ctx.currentTime
    node.gain.gain.linearRampToValueAtTime(0.001, now + 0.3)
    setTimeout(() => { try { node.osc.stop() } catch{} node.osc.disconnect(); node.gain.disconnect(); if (this.urgeRumbleNode === node) this.urgeRumbleNode = null }, 320)
  }

  playCoughBurst() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * 0.12
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.025))
    const noise = this.ctx.createBufferSource(); noise.buffer = noiseBuffer
    const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(900, now); filter.Q.setValueAtTime(2.0, now)
    const noiseGain = this.ctx.createGain(); noiseGain.gain.setValueAtTime(0.4, now); noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    noise.connect(filter); filter.connect(noiseGain); noiseGain.connect(this.sfxGain); noise.start(now)
    const osc = this.ctx.createOscillator(); const thumpGain = this.ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(140, now); osc.frequency.exponentialRampToValueAtTime(32, now + 0.22)
    thumpGain.gain.setValueAtTime(0.5, now); thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc.connect(thumpGain); thumpGain.connect(this.sfxGain); osc.start(now); osc.stop(now + 0.24)
  }

  playIngest() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
      osc.type = 'sine'; const f = 220 + i * 110 + Math.random() * 40
      osc.frequency.setValueAtTime(f, now + i * 0.08); osc.frequency.exponentialRampToValueAtTime(f * 1.6, now + i * 0.08 + 0.07)
      gain.gain.setValueAtTime(0.01, now + i * 0.08); gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.07)
      osc.connect(gain); gain.connect(this.sfxGain); osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.08)
    }
  }

  playSquish(force = 1.0) {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.playSqueezeFM(force)
  }

  playSlap(intensity = 1.0) {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseBuffer.length; i++) output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015))
    const whiteNoise = this.ctx.createBufferSource(); whiteNoise.buffer = noiseBuffer
    const slapFilter = this.ctx.createBiquadFilter(); slapFilter.type = 'bandpass'; slapFilter.frequency.setValueAtTime(800 + intensity * 400, now); slapFilter.Q.setValueAtTime(3.0, now)
    const slapGain = this.ctx.createGain(); slapGain.gain.setValueAtTime(0.35 * intensity, now); slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    whiteNoise.connect(slapFilter); slapFilter.connect(slapGain); slapGain.connect(this.sfxGain); whiteNoise.start(now)
    const osc = this.ctx.createOscillator(); const thumpGain = this.ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(160, now); osc.frequency.exponentialRampToValueAtTime(45, now + 0.2)
    thumpGain.gain.setValueAtTime(0.4 * intensity, now); thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.connect(thumpGain); thumpGain.connect(this.sfxGain); osc.start(now); osc.stop(now + 0.22)
  }

  playLeakSpurt() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.25, this.ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseBuffer.length; i++) output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08))
    const whiteNoise = this.ctx.createBufferSource(); whiteNoise.buffer = noiseBuffer
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(1200, now)
    const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    whiteNoise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); whiteNoise.start(now)
  }

  playSootheBreath() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(320, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.6)
    gain.gain.setValueAtTime(0.01, now); gain.gain.linearRampToValueAtTime(0.2, now + 0.15); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc.connect(gain); gain.connect(this.sfxGain); osc.start(now); osc.stop(now + 0.65)
  }

  playCue(kind) {
    const notes = CUES[kind]
    if (!notes || !this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    for (const [freq, at, len, type, vol] of notes) {
      const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain()
      osc.type = type; osc.frequency.setValueAtTime(freq, now + at)
      gain.gain.setValueAtTime(0.0001, now + at); gain.gain.linearRampToValueAtTime(vol, now + at + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len)
      osc.connect(gain); gain.connect(this.sfxGain); osc.start(now + at); osc.stop(now + at + len + 0.02)
    }
  }

  update(dt) {
    this.clock += dt
    if (this.creakCooldown > 0) this.creakCooldown -= dt
    // A waiting reaction gets its turn once the line before it ends.
    if (this.pending && this.clock >= this.busyUntil) {
      const { category, until } = this.pending
      this.pending = null
      if (this.clock <= until) this.speak(category)
    }
  }
}

export const audio = new AudioManager()
