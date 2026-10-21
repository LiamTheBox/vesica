// The sound effects, synthesised with Web Audio (no sound files, so they work offline).
// The bladder's voice is in voice.js.

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
    this.sfxVolume = 0.8

    this.dynamicJet = null
    this.clenchHumNode = null
    this.urgeRumbleNode = null
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

  // Wakes the engine for an effect and returns the time to start it at, or null when
  // effects are off or muted.
  begin() {
    if (!this.sfxEnabled || this.isMasterMuted) return null
    this.initCtx()
    return this.ctx.currentTime
  }

  // In the background: silence the engine.
  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend()
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  // A buffer of `seconds` of noise, sample i shaped by `shape(i, length)`.
  noise(seconds, shape) {
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * shape(i, data.length)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    return source
  }

  // Fades out a held sound (the jet, hum or rumble) over `fade` s, then frees it.
  release(node, fade, clear) {
    node.gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + fade)
    setTimeout(() => {
      try { node.source.stop() } catch {}
      node.source.disconnect()
      node.gain.disconnect()
      clear()
    }, fade * 1000 + 10)
  }

  startDynamicJet() {
    const now = this.begin()
    if (now === null || this.dynamicJet) return

    // Pink-ish noise, looped.
    const size = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < size; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99 * b0 + white * 0.055
      b1 = 0.96 * b1 + white * 0.085
      b2 = 0.88 * b2 + white * 0.16
      data[i] = (b0 + b1 + b2) * 0.22
    }
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(500, now)
    filter.Q.setValueAtTime(2.5, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.15)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    source.start()
    this.dynamicJet = { source, filter, gain }
  }

  updateDynamicJet(flowRate, pressure) {
    if (!this.dynamicJet || !this.ctx) return
    const now = this.ctx.currentTime
    this.dynamicJet.filter.frequency.setTargetAtTime(Math.min(2200, 400 + flowRate * 38 + pressure * 10), now, 0.05)
    this.dynamicJet.gain.gain.setTargetAtTime(Math.min(0.38, 0.05 + (flowRate / 20.0) * 0.3), now, 0.05)
  }

  stopDynamicJet() {
    const jet = this.dynamicJet
    if (!jet) return
    this.release(jet, 0.12, () => { if (this.dynamicJet === jet) this.dynamicJet = null })
  }

  playGranularSlosh(magnitude) {
    if (magnitude < 0.15) return
    const now = this.begin()
    if (now === null) return
    const source = this.noise(0.22, (i, n) => Math.sin((i / n) * Math.PI))
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(220 + magnitude * 300, now)
    filter.Q.setValueAtTime(2.0, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(Math.min(0.2, magnitude * 0.08), now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    source.start(now)
  }

  playSqueezeFM(amount) {
    const now = this.begin()
    if (now === null) return
    const carrier = this.ctx.createOscillator()
    carrier.type = 'triangle'
    carrier.frequency.setValueAtTime(80 + amount * 40, now)
    carrier.frequency.exponentialRampToValueAtTime(35, now + 0.18)
    const modulator = this.ctx.createOscillator()
    modulator.type = 'sine'
    modulator.frequency.setValueAtTime(240, now)
    const modGain = this.ctx.createGain()
    modGain.gain.setValueAtTime(amount * 90, now)
    modulator.connect(modGain)
    modGain.connect(carrier.frequency)

    const out = this.ctx.createGain()
    out.gain.setValueAtTime(0.25 * amount, now)
    out.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    carrier.connect(out)
    out.connect(this.sfxGain)
    modulator.start(now)
    carrier.start(now)
    modulator.stop(now + 0.19)
    carrier.stop(now + 0.19)
  }

  playTensionCreak() {
    const now = this.begin()
    if (now === null) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(2800 + Math.random() * 800, now)
    osc.frequency.linearRampToValueAtTime(1400, now + 0.06)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + 0.065)
  }

  // `volume` scales it, `pan` places it left (-1) to right (1).
  playUreterSquirt(volume = 1, pan = 0) {
    const now = this.begin()
    if (now === null) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.14)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(350, now)
    filter.frequency.linearRampToValueAtTime(950, now + 0.12)
    filter.Q.setValueAtTime(4.0, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.18 * volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(filter)
    filter.connect(gain)
    if (pan && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner()
      panner.pan.setValueAtTime(pan, now)
      gain.connect(panner)
      panner.connect(this.sfxGain)
    } else {
      gain.connect(this.sfxGain)
    }
    osc.start(now)
    osc.stop(now + 0.15)
  }

  // A held tone that fades in: the clench hum and the urge rumble.
  startDrone(type, frequency, volume, fadeIn) {
    const now = this.begin()
    if (now === null) return null
    const source = this.ctx.createOscillator()
    source.type = type
    source.frequency.setValueAtTime(frequency, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(volume, now + fadeIn)
    source.connect(gain)
    gain.connect(this.sfxGain)
    source.start()
    return { source, gain }
  }

  startClenchHum() {
    if (!this.clenchHumNode) this.clenchHumNode = this.startDrone('sine', 65, 0.18, 0.1)
  }

  // The hum rises as the clench tires.
  updateClenchHum(staminaRatio) {
    if (!this.clenchHumNode || !this.ctx) return
    this.clenchHumNode.source.frequency.setTargetAtTime(65 + (1.0 - staminaRatio) * 55, this.ctx.currentTime, 0.05)
  }

  stopClenchHum() {
    const node = this.clenchHumNode
    if (!node) return
    this.release(node, 0.08, () => { if (this.clenchHumNode === node) this.clenchHumNode = null })
  }

  startUrgeRumble() {
    if (!this.urgeRumbleNode) this.urgeRumbleNode = this.startDrone('triangle', 36, 0.3, 0.4)
  }

  stopUrgeRumble() {
    const node = this.urgeRumbleNode
    if (!node) return
    this.release(node, 0.3, () => { if (this.urgeRumbleNode === node) this.urgeRumbleNode = null })
  }

  // A burst of noise over a falling thump: a cough, or (sharper) a slap.
  burstAndThump(now, { noiseSeconds, decay, frequency, q, noiseGain, thumpFrom, thumpTo, thumpSeconds, thumpGain }) {
    const source = this.noise(noiseSeconds, (i) => Math.exp(-i / (this.ctx.sampleRate * decay)))
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(frequency, now)
    filter.Q.setValueAtTime(q, now)
    const burst = this.ctx.createGain()
    burst.gain.setValueAtTime(noiseGain, now)
    burst.gain.exponentialRampToValueAtTime(0.001, now + noiseSeconds)
    source.connect(filter)
    filter.connect(burst)
    burst.connect(this.sfxGain)
    source.start(now)

    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(thumpFrom, now)
    osc.frequency.exponentialRampToValueAtTime(thumpTo, now + thumpSeconds)
    const thump = this.ctx.createGain()
    thump.gain.setValueAtTime(thumpGain, now)
    thump.gain.exponentialRampToValueAtTime(0.001, now + thumpSeconds)
    osc.connect(thump)
    thump.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + thumpSeconds + 0.02)
  }

  playCoughBurst() {
    const now = this.begin()
    if (now === null) return
    this.burstAndThump(now, { noiseSeconds: 0.12, decay: 0.025, frequency: 900, q: 2.0, noiseGain: 0.4, thumpFrom: 140, thumpTo: 32, thumpSeconds: 0.22, thumpGain: 0.5 })
  }

  playSlap(intensity = 1.0) {
    const now = this.begin()
    if (now === null) return
    this.burstAndThump(now, {
      noiseSeconds: 0.08, decay: 0.015, frequency: 800 + intensity * 400, q: 3.0, noiseGain: 0.35 * intensity,
      thumpFrom: 160, thumpTo: 45, thumpSeconds: 0.2, thumpGain: 0.4 * intensity,
    })
  }

  // Three rising bubbles: a gulp.
  playIngest() {
    const now = this.begin()
    if (now === null) return
    for (let i = 0; i < 3; i++) {
      const at = now + i * 0.08
      const f = 220 + i * 110 + Math.random() * 40
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, at)
      osc.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.07)
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.01, at)
      gain.gain.linearRampToValueAtTime(0.18, at + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(at)
      osc.stop(at + 0.08)
    }
  }

  playSquish(force = 1.0) {
    this.playSqueezeFM(force)
  }

  playLeakSpurt() {
    const now = this.begin()
    if (now === null) return
    const source = this.noise(0.25, (i) => Math.exp(-i / (this.ctx.sampleRate * 0.08)))
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1200, now)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    source.start(now)
  }

  // A falling tone: `from` to `to` Hz over `seconds`, peaking at `volume`.
  playGlide(from, to, seconds, volume, type = 'sine') {
    const now = this.begin()
    if (now === null) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(from, now)
    osc.frequency.exponentialRampToValueAtTime(to, now + seconds)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.01, now)
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.15, seconds / 4))
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(now)
    osc.stop(now + seconds + 0.05)
  }

  playSootheBreath() {
    this.playGlide(320, 120, 0.6, 0.2)
  }

  playCue(kind) {
    const notes = CUES[kind]
    const now = notes ? this.begin() : null
    if (now === null) return
    for (const [freq, at, len, type, vol] of notes) {
      const osc = this.ctx.createOscillator()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now + at)
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.linearRampToValueAtTime(vol, now + at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(now + at)
      osc.stop(now + at + len + 0.02)
    }
  }
}

export const audio = new AudioManager()
