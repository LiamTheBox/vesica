import { addRipple, impartSloshForce, physicsOf, touchJolt } from './sim'

// Direct touches on the bladder, ported from the original's pokeBladder(), slapBladder(),
// squeeze and orbit handlers. `local` is the hit point in the bladder mesh's own space.
// The wall dent itself is visual: Organ.jsx applies it when it sees the poke/slap event.

const point = (p) => ({ x: p.x, y: p.y, z: p.z })

// Sphincter strain from one poke or one slap (requested: 5 % each; the original's
// were 8 % and 15 %). A drag pokes on every move, so Organ.jsx passes a share of it.
export const POKE_STRAIN = 0.05
export const SLAP_STRAIN = 0.05
// The most force one hit lands, however hard it's asked to (requested: a flurry of them
// crumpled the wall). How far the wall gives, however many land, is limited in organRig.js.
export const POKE_LIMIT = 2.4
export const SLAP_LIMIT = 3.0

// strength: 2.2 (physics `squishForce`) for a tap, 0.7 for each step of a drag.
export function pokeAt(sim, out, local, strength, { touch = false, strain = POKE_STRAIN } = {}) {
  const force = Math.min(strength, POKE_LIMIT)
  impartSloshForce(sim, local.x * 2.5 * force, local.z * 2.5 * force)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.3 * force)
  sim.sphincterToneStrain = Math.min(1.0, sim.sphincterToneStrain + strain)
  touchJolt(sim, force / 2.2)
  out.push({ type: 'poke', local: point(local), strength: force, touch })
}

// strength: 2.0 for a tap in slap mode, up to 3.0 for a swipe.
export function slapAt(sim, out, local, strength = 1.8, { haptic = false, strain = SLAP_STRAIN } = {}) {
  const force = Math.min(strength, SLAP_LIMIT)
  const phys = physicsOf(sim)
  addRipple(sim, {
    center: point(local),
    radius: 0.1,
    maxRadius: 3.8,
    speed: phys.waveSpeed,
    amplitude: 0.65 * force,
    decay: phys.rippleDecay,
  })
  impartSloshForce(sim, local.x * 4.0 * force, local.z * 4.0 * force)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.6 * force)
  sim.sphincterToneStrain = Math.min(1.0, sim.sphincterToneStrain + strain)
  touchJolt(sim, force / 2.4)
  out.push({ type: 'slap', local: point(local), strength: force, haptic })
}

export function squeezeStart(sim, out) {
  sim.targetSqueezeY = 0.35
  out.push({ type: 'squeezeStart' })
}

export function squeezeDrag(sim, out, dx, dy) {
  sim.targetSqueezeY = Math.min(0.65, Math.max(0.0, sim.targetSqueezeY + Math.abs(dy) * 0.004 + Math.abs(dx) * 0.002))
  out.push({ type: 'squeezeDrag', amount: sim.targetSqueezeY })
}

export function squeezeRelease(sim, out) {
  sim.targetSqueezeY = 0
  out.push({ type: 'squeezeRelease' })
}

// A cancelled touch (e.g. the OS took over) lets go without the release slosh.
export function squeezeCancel(sim) {
  sim.targetSqueezeY = 0
}

// Dragging the camera around rocks the fluid.
export function orbitDrag(sim, out, dx, dy) {
  impartSloshForce(sim, dx * 0.15, dy * 0.15)
}

// Two-finger pinch in Squeeze mode (original touchmove handler): fingers closing by
// `diff` px squeeze harder, spreading them eases off.
export function squeezePinch(sim, out, diff) {
  sim.targetSqueezeY = Math.min(0.7, Math.max(0.0, sim.targetSqueezeY + diff * 0.005))
  out.push({ type: 'squeezeDrag', amount: sim.targetSqueezeY })
}
