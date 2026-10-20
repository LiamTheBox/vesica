import { impartSloshForce } from './sim'

// Direct touches on the bladder. These keep the React port's current strengths;
// ROADMAP M2 brings them back in line with the original (strain, force, drag/swipe).

const touchRipple = (center, amplitude) => ({ center, radius: 0.1, maxRadius: 3.8, speed: 7.5, amplitude, decay: 3.5 })

export function pokeAt(sim, out, local) {
  sim.ripples.push(touchRipple({ x: local.x, y: local.y, z: local.z }, 0.7))
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.3)
  impartSloshForce(sim, local.x * 1.5, local.z * 1.5)
  out.push({ type: 'poke' })
}

export function slapAt(sim, out, local, soundStrength = 2.0) {
  sim.ripples.push(touchRipple({ x: local.x, y: local.y, z: local.z }, 1.5))
  sim.jiggleIntensity = Math.min(1.0, sim.jiggleIntensity + 0.6)
  impartSloshForce(sim, local.x * 4.0, local.z * 4.0)
  out.push({ type: 'slap', strength: soundStrength })
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

// The Slap button: the organ picks a random point on its surface (see Organ.jsx).
export function requestSlap(sim, out) {
  out.push({ type: 'slapRequest' })
}
