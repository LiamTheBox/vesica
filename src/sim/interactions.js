import { impartSloshForce, physicsOf } from './sim'

// Direct touches on the bladder, ported from the original's pokeBladder(), slapBladder(),
// squeeze and orbit handlers. `local` is the hit point in the bladder mesh's own space.
// The wall dent itself is visual: Organ.jsx applies it when it sees the poke/slap event.

const point = (p) => ({ x: p.x, y: p.y, z: p.z })

// strength: 2.2 (physics `squishForce`) for a tap, 0.7 for each step of a drag.
export function pokeAt(sim, out, local, strength, { touch = false } = {}) {
  impartSloshForce(sim, local.x * 2.5 * strength, local.z * 2.5 * strength)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.3 * strength)
  sim.sphincterToneStrain = Math.min(1.0, sim.sphincterToneStrain + 0.08)
  out.push({ type: 'poke', local: point(local), strength, touch })
}

// strength: 2.0 for a tap in slap mode, 2.4 for the Slap button, up to 3.0 for a swipe.
export function slapAt(sim, out, local, strength = 1.8, { haptic = false } = {}) {
  const phys = physicsOf(sim)
  sim.ripples.push({
    center: point(local),
    radius: 0.1,
    maxRadius: 3.8,
    speed: phys.waveSpeed,
    amplitude: 0.65 * strength,
    decay: phys.rippleDecay,
  })
  impartSloshForce(sim, local.x * 4.0 * strength, local.z * 4.0 * strength)
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.6 * strength)
  sim.sphincterToneStrain = Math.min(1.0, sim.sphincterToneStrain + 0.15)
  out.push({ type: 'slap', local: point(local), strength, haptic })
}

// The Slap button: a hit at a random point around the bladder's equator.
export function slapRandom(sim, out, rng = Math.random) {
  const angle = rng() * Math.PI * 2
  const local = { x: Math.cos(angle) * 2.2, y: (rng() - 0.5) * 0.8, z: Math.sin(angle) * 2.2 }
  slapAt(sim, out, local, 2.4)
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
