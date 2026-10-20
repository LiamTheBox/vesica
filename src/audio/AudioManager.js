const VOICE_DATABASE = {
  deflated: ["Ah, finally empty and flat as a pancake.", "Completely relaxed. No tension at all down here.", "Just a tiny puddle at the base, perfectly fine.", "Everything is quiet. Just resting nicely.", "I feel light, stretchy, and totally unbothered.", "Zero pressure. Ah, sweet bliss.", "My detrusor walls are completely at ease.", "Fresh, flat, and spacious in the pelvic floor.", "Peace and quiet down here at last.", "So cozy, soft, and wrinkled.", "Not a single drop causing any stretch.", "All quiet on the urethral front.", "Baseline resting state restored.", "Total muscular tranquility achieved.", "Smooth, unstretched, and completely limp.", "Pelvic floor is resting peacefully.", "Rugae folds are completely bunched together.", "Zero hydrostatic strain to report.", "I could take a long nap like this.", "Detrusor tone is completely settled."],
  nominal: ["Ooh, incoming delivery from the kidneys.", "Starting to round out a little bit.", "A steady trickle... nothing I can't handle with ease.", "Hydration detected. Expanding gently.", "The rugae folds are smoothing out nicely.", "Just a casual level of fluid. Totally comfortable.", "I can hold this all day without breaking a sweat.", "Just getting warmed up below.", "A few drops settling in the base.", "Nice, gentle inflow from the ureters.", "Detrusor is stretching smoothly with no strain.", "Everything is under control down here.", "Hardly noticeable, plenty of room left.", "Relaxed baseline fill in progress.", "Hydration filtration running smoothly.", "Mild expansion underway, feeling fine.", "Fluid level is rising casually.", "No pressure on the sphincter yet.", "Supple elastic walls accommodating the volume.", "Trigone area is stable and calm."],
  distended: ["Okay, I'm definitely waking up now.", "Starting to feel a distinct stretch against my walls.", "We're past the halfway mark... just so you know!", "The stretch receptors are sending mild pings upstairs.", "Sphincter is holding firm, but I can feel the hydrostatic weight.", "Pressure's climbing into double digits.", "Definitely starting to feel heavy down here.", "My lining is smoothing out almost completely.", "You might want to think about a restroom break soon.", "Getting noticeably round in the pelvis.", "Hydrostatic weight is steadily climbing.", "Detrusor tone is starting to respond.", "Not urgent yet, but don't ignore me.", "The stretch signals are firing more frequently.", "Fluid volume is clearly building up.", "Feeling plump, taut, and slightly heavy.", "Sphincter tone is beginning active retention.", "Keep an eye on the intake, getting full.", "The walls are feeling the expansion.", "Elastic threshold is halfway crossed."],
  full: ["Alright, this is getting seriously tight!", "I'm ballooning! Please find a bathroom soon!", "My walls are stretched thin... I can barely expand more!", "Sphincter, stay clamped! Don't you dare let go!", "Ugh, every single drop from the ureters feels heavy now!", "My detrusor muscle is working overtime to hold this!", "Pressure warning! It's pressing against everything!", "I feel like a taut water balloon ready to burst!", "The internal pressure is getting very uncomfortable!", "Hold firm! Squeeze the pelvic floor!", "Elastic tension is reaching its upper limits!", "Please, don't drink anything else right now!", "Urgency signals are firing non-stop!", "The walls are stretched paper-thin down here!", "Every slosh sends a shockwave to the valve!", "Detrusor muscle fibers are straining hard!", "I need a restroom immediately, this is intense!", "The sphincter is feeling the full fluid load!", "Overpressure approaching critical territory!", "Brace yourself, holding this is getting difficult!"],
  critical: ["I CAN'T HOLD IT! The sphincter is twitching out of control!", "SPASM DETECTED! Squeeeeeeze with everything you've got!", "My muscle is completely exhausted... it's trembling!", "The pressure is through the roof! Over fifty cmH2O!", "Sphincter fatigue is at maximum! I'm losing grip!", "Emergency containment failure imminent!", "The detrusor is spasming violently!", "Hold on tight! The valve is shuddering!", "I'm shaking down here! Release the pressure!", "Total retention limit reached! Clench now!", "Overpressure alert! The seal is about to break!", "Every single second is a struggle to hold!", "The valve cannot withstand this force much longer!", "Containment breach warning! Take action!", "Intense detrusor seizure underway!", "I'm redlining! Relieve this tension immediately!", "Tremors are shaking the entire pelvic base!", "Elastic limit completely exceeded!", "The sphincter is burning with fatigue!", "Critical spasm! Hit the void valve!"],
  leak: ["Aagh! A micro-spurt slipped through!", "Pressure was too high! I leaked a little!", "Oof! That surge forced the valve open!", "That was close... resealed, but I lost a few drops!", "Clench tighter! It's leaking under this pressure!", "A momentary leak escaped before resealing!", "The valve gave way for just a second!", "Pressure bled off with a quick spurt!", "I couldn't hold back that sudden surge!", "Micro-breach! Squeeze to lock it down!", "A quick spurt got past the sphincter!", "Overpressure leak! Resealed just in time!", "That spasm forced a leak out!", "Lost containment for a fraction of a second!", "Tension forced a leak! Stabilizing now...", "The hydrostatic burst broke through briefly!"],
  clench: ["Holding tight! Squeezing the valve!", "Sphincter braced! Holding back the surge!", "Good clamp! That blocked the leak!", "Holding on with all my strength!", "Kegel reinforcement active! Valve locked!", "Clamping down firmly against the pressure!", "Sphincter reinforced! Holding the line!", "Locking the urethral seal tightly!", "Squeezing hard! That stopped the breach!", "Pelvic floor contracted, barrier holding!", "Tight clench engaged, containment secured!", "Straining to keep the valve clamped!", "Holding the floodgate shut with active tone!", "Braced against the internal hydrostatic push!", "Reinforcing the neck tightly!", "Squeezing the sphincter with maximum effort!"],
  soothe: ["Ahhh... deep breath. Tension going down.", "Relaxing the spasm... that feels much calmer.", "Detrusor tone lowering nicely.", "Phew... settling back to a calm baseline.", "Soothing the muscle fibers... spasm subsiding.", "Releasing residual strain... much better.", "Detrusor excitability decreasing smoothly.", "Calming the pelvic tension... breathing out.", "The pressure spikes are smoothing over.", "Lowering muscular tone... thank goodness.", "Gentle relief washing over the tissue.", "Spasms fading away into a calm stretch.", "Detrusor walls relaxing their grip.", "Deep soothing breath... tone normalizing.", "Tension dissipating from the bladder neck.", "Restoring quiet elasticity to the walls."],
  cough: ["Oof! That cough spiked the pressure!", "A sudden jolt straight to the pelvic floor!", "Brace yourself during those sneezes!", "Whoa! That intra-abdominal spike was close!", "That cough nearly blew the sphincter open!"],
  involuntary: ["I CAN'T HOLD IT ANYMORE! The sphincter collapsed!", "FAILURE! I'm completely letting go!", "It's rushing out! The pressure was too much!", "The valve gave out entirely! Involuntary release!", "Total muscular surrender! It's all pouring out!", "I warned you! Containment completely lost!", "The sphincter failed completely under the weight!", "Uncontrolled emptying in progress!", "The valve gave up! Everything is releasing!", "Complete retention breakdown! Total void!", "Muscular collapse! It won't stop flowing!", "The pressure destroyed my grip! Total release!"],
  poked: ["Hey! Don't poke me while I'm holding this!", "Ouch! That sloshed everything around!", "Hands off! It's delicate in here!", "Careful! You're making the pressure spike!", "Whoa! That prod sent shockwaves to the valve!", "Stop poking! You'll trigger a spasm!", "Eep! That indentation rattled the sphincter!", "Hands to yourself! That was right on the trigone!", "Quit prodding me, I'm under enough stress!", "That poke nearly forced a leak!", "Oof! Watch where your fingers are going!", "You're squishing the walls too roughly!", "Hey! That caused a massive pressure wave!", "Do not prod a full bladder like that!", "Careful! That soft-body dent hurts!", "That direct hit rattled the detrusor!"],
  squeezed: ["Hey! Squeezing me is raising the pressure dangerously!", "Careful! You're gonna pop me if you squeeze so hard!", "Oof! The fluid has nowhere else to go!", "You're compressing the walls! The valve is straining!", "Stop squeezing! That's spiking the hydrostatic load!", "The lateral bulge is stretching me to the limit!", "You're forcing fluid straight into the sphincter neck!", "Aah! The Poisson expansion is too intense!", "Don't crush me like that, it's about to leak!", "Squeeze release! The pressure is off the charts!", "Compressing me is making retention impossible!", "Ouch! The internal walls can't take this clamp!", "You're squeezing out micro-spurts, stop!", "Let go! The squeeze is overwhelming the tone!", "High compression detected! Release the grip!", "You're crushing the lumen, let it expand!"],
  shaken: ["Whoaaa! Stop shaking me!", "Everything is sloshing wildly inside!", "Ahhh! The fluid waves are hitting the valve!", "Hey! I'm not a cocktail shaker!", "You're making the fluid slosh everywhere!", "Stop! The slosh inertia is battering the sphincter!", "Whoa! The dual-body fluid lag is rocking me!", "Internal waves crashing against the neck!", "Quit jostling me around so violently!", "The slosh resonance is peaking! Stop shaking!", "All that sloshing is triggering reflex spasms!", "You're tossing fluid mass all over the place!", "Stop the agitation! I'm getting dizzy down here!", "The hydrodynamic waves are pushing the limit!", "Violent slosh detected! Keep it steady!", "Whoa! The fluid momentum is smashing the walls!"],
  voiding: ["Aaaahhh... sweet, glorious relief!", "Yes! Let it all flow out!", "Oh, that feels so much better...", "Pressure dropping... ahhh, heaven.", "Sphincter dilating... emptying in progress.", "Look at that stream go! What a release!", "Finally, the tension is melting away!", "Ahhh, my elastic walls are shrinking back.", "Steady stream, optimal drainage velocity.", "All that heavy fluid... just washing away.", "Relaxing every muscle fiber as it drains.", "What a wonderful feeling of decompression.", "Deflating smoothly back to baseline.", "The relief is overwhelming... draining out.", "Sphincter wide open, steady evacuation.", "Almost done... draining the final drops.", "Pure comfort as the volume recedes.", "Back to normal capacity... ahhh."]
}

class AudioManager {
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
    this.speechCooldown = 0.0
    this.minInterval = 2.5 // Lowered from 10.0 to make it more responsive
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

  speak(category, force = false) {
    if (!this.voiceEnabled || this.isMasterMuted || !this.synth) return
    
    // If forced, cancel current speech immediately to prioritize new line
    if (force) {
      this.synth.cancel()
      this.speechCooldown = 0
    } else if (this.speechCooldown > 0 || this.synth.speaking) {
      return
    }

    const list = VOICE_DATABASE[category]
    if (!list || list.length === 0) return

    let recent = this.recentHistory.get(category) || []
    let available = list.map((_, i) => i).filter(i => !recent.includes(i))
    if (available.length === 0) available = list.map((_, i) => i)

    const chosenIndex = available[Math.floor(Math.random() * available.length)]
    recent.push(chosenIndex)
    if (recent.length > this.historySize) recent.shift()
    this.recentHistory.set(category, recent)

    const text = list[chosenIndex]
    this.speechCooldown = this.minInterval

    const utterance = new SpeechSynthesisUtterance(text)
    if (this.femaleVoice) utterance.voice = this.femaleVoice
    utterance.volume = this.voiceVolume

    if (['critical', 'involuntary', 'leak'].includes(category)) {
      utterance.pitch = 1.45; utterance.rate = 1.25
    } else if (['shaken', 'squeezed', 'clench', 'cough'].includes(category)) {
      utterance.pitch = 1.35; utterance.rate = 1.2
    } else if (category === 'soothe') {
      utterance.pitch = 1.15; utterance.rate = 0.9
    } else if (['voiding', 'deflated'].includes(category)) {
      utterance.pitch = 1.15; utterance.rate = 0.95
    } else {
      utterance.pitch = 1.2; utterance.rate = 1.05
    }

    this.synth.speak(utterance)
    if (this.onSubtitle) this.onSubtitle(text, category)
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
    this.dynamicJet.gain.gain.setTargetAtTime(Math.min(0.38, 0.05 + (flowRate / 30.0) * 0.3), now, 0.05)
  }

  stopDynamicJet() {
    if (!this.dynamicJet) return
    const jet = this.dynamicJet; const now = this.ctx.currentTime
    jet.gain.gain.linearRampToValueAtTime(0.001, now + 0.12)
    setTimeout(() => { try { jet.source.stop() } catch(e){} jet.source.disconnect(); jet.gain.disconnect(); if (this.dynamicJet === jet) this.dynamicJet = null }, 130)
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

  playUreterSquirt() {
    if (!this.sfxEnabled || this.isMasterMuted) return
    this.initCtx(); const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator(); const filter = this.ctx.createBiquadFilter(); const gain = this.ctx.createGain()
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.14)
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(350, now); filter.frequency.linearRampToValueAtTime(950, now + 0.12); filter.Q.setValueAtTime(4.0, now)
    gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); osc.start(now); osc.stop(now + 0.15)
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
    setTimeout(() => { try { node.osc.stop() } catch(e){} node.osc.disconnect(); node.gain.disconnect(); if (this.clenchHumNode === node) this.clenchHumNode = null }, 90)
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
    setTimeout(() => { try { node.osc.stop() } catch(e){} node.osc.disconnect(); node.gain.disconnect(); if (this.urgeRumbleNode === node) this.urgeRumbleNode = null }, 320)
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

  update(dt) {
    if (this.speechCooldown > 0) this.speechCooldown -= dt
    if (this.creakCooldown > 0) this.creakCooldown -= dt
  }
}

export const audio = new AudioManager()
