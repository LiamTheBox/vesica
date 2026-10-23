import * as THREE from 'three'

// Body language. It breathes, by mood: breaths a second, and how deep as a share of its
// size (slow and deep asleep, quick and shallow in a panic).
const BREATH = {
  sleepy: [0.16, 0.02], calm: [0.25, 0.012], uneasy: [0.35, 0.01], desperate: [0.55, 0.008], panic: [0.9, 0.006],
  relieved: [0.2, 0.018], embarrassed: [0.4, 0.008], annoyed: [0.45, 0.012], proud: [0.3, 0.014],
}
const STILL = [0, 0]
// And it moves when something happens (emote, picked by feedback/emotes.js): a happy bounce stretches it up from the neck
// and back (a spring: rad/s, damping ratio, kick); a sigh or a huff swells it all round and
// lets it settle; a shudder shakes it; when the clench gives out it droops, and it slumps a
// little when sleepy. A blush and a flash colour the wall's glow. These move the whole organ
// (objects.body), about the neck: through the wall's springs, which lag ~0.7 s behind their
// targets, anything quicker than a breath would be smoothed away.
const HOP = { omega: 13, damping: 0.25, kick: 1.0 }
const PUFF = { omega: 5, damping: 0.5, sigh: 0.22, huff: 0.35, creak: 0.12 }
const SHUDDER = { amp: 0.06, seconds: 0.8 }
const NERVOUS_SHAKE = 0.015 // while a warned urge or sneeze is on its way
// A strained sphincter trembles: from 30 % strain, up to this at 100 %.
const STRAIN_SHAKE = { from: 0.3, amp: 0.02 }
const DROOP = { height: 0.06, seconds: 2.5, sleepy: 0.35 }
// With reduced motion asked for (the system setting), the shakes are this much as big.
const REDUCED_SHAKE = 0.25
export const WALL_EMISSIVE = new THREE.Color(0x7a1822)
export const BLUSH_COLOR = new THREE.Color(0xff2d75)

// The springs and fading effects behind the moves. `scale` and `offset` are the body
// group's transform for the frame (pose), `flash` and `blush` the wall's glow.
export function createBodyLanguage() {
  let breathPhase = 0, breathRate = 0, breathDepth = 0
  let hop = 0, hopV = 0
  let puff = 0, puffV = 0
  let shudder = 0, droop = 0, nervous = 0
  const state = { flash: 0, blush: 0, scale: new THREE.Vector3(1, 1, 1), offset: new THREE.Vector3() }

  // Starts one of emoteFor's moves.
  function emote(kind) {
    if (kind === 'hop') {
      hopV += HOP.kick
      state.flash = Math.max(state.flash, 0.8)
    } else if (kind === 'sigh' || kind === 'huff') {
      puffV += PUFF[kind]
    } else if (kind === 'creak') {
      puffV += PUFF.creak
      state.flash = Math.max(state.flash, 0.6)
    } else if (kind === 'shudder') {
      shudder = 1
    } else if (kind === 'droop') {
      droop = 1
    }
  }

  // The springs and fading effects move on; breathing follows the mood (none: it holds still).
  function step(sim, dt, mood) {
    const [rate, depth] = mood ? BREATH[mood] ?? BREATH.calm : STILL
    const ease = Math.min(1, dt * 1.5)
    breathRate += (rate - breathRate) * ease
    breathDepth += (depth - breathDepth) * ease
    breathPhase = (breathPhase + Math.PI * 2 * breathRate * dt) % (Math.PI * 2)
    hopV -= (HOP.omega * HOP.omega * hop + 2 * HOP.damping * HOP.omega * hopV) * dt
    hop += hopV * dt
    puffV -= (PUFF.omega * PUFF.omega * puff + 2 * PUFF.damping * PUFF.omega * puffV) * dt
    puff += puffV * dt
    shudder = Math.max(0, shudder - dt / SHUDDER.seconds)
    droop = Math.max(0, droop - dt / DROOP.seconds)
    state.flash = Math.max(0, state.flash - dt * 2.5)
    state.blush += ((mood === 'embarrassed' ? 1 : 0) - state.blush) * Math.min(1, dt * 2)
    nervous += ((sim.urgeWarned || sim.coughWarned ? 1 : 0) - nervous) * Math.min(1, dt * 8)
  }

  // Breathing and swelling, a bounce up or a droop down, about the neck (which stays put);
  // and a shake: a shudder, a shiver before a warned urge, a strained tremble.
  function pose(sim, neck, timeSec, mood, reducedMotion = false) {
    const { scale, offset } = state
    const swell = 1 + breathDepth * Math.sin(breathPhase) + puff
    const sag = Math.max(droop, mood === 'sleepy' ? DROOP.sleepy : 0) * DROOP.height
    scale.set(swell * (1 - 0.5 * hop + 0.5 * sag), swell * (1 + hop - sag), swell * (1 - 0.5 * hop + 0.5 * sag))
    const strain = Math.max(0, sim.sphincterToneStrain - STRAIN_SHAKE.from) / (1 - STRAIN_SHAKE.from)
    const shake = (SHUDDER.amp * shudder + NERVOUS_SHAKE * nervous + STRAIN_SHAKE.amp * Math.min(1, strain)) * (reducedMotion ? REDUCED_SHAKE : 1)
    offset.set(
      neck.x * (1 - scale.x) + shake * Math.sin(timeSec * 47.0),
      neck.y * (1 - scale.y) + shake * 0.5 * Math.sin(timeSec * 53.0 + 1.0),
      neck.z * (1 - scale.z) + shake * Math.sin(timeSec * 41.0 + 2.0),
    )
  }

  return Object.assign(state, { emote, step, pose })
}
