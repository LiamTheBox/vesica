import * as THREE from 'three'
import { computeNormals } from './normals'

// The urine stream (requested: one opening, not a hose, and less uniform). A jet leaves
// the urethral opening, thins as it falls and speeds up, twists like a ribbon near the
// outlet (the opening is a slit, so the jet's cross-section flips back and forth), swells
// and pinches along its length, and breaks into drops. Its flow, aim and twist wander all
// the time, and every wobble travels down the jet with the fluid: each ring of the jet is
// drawn from the outlet's state at the moment that fluid left it. Leaks come out in
// spurts; the end of a void dribbles.

const RINGS = 40
const SIDES = 12
const MAX_DROPS = 140
const HISTORY = 160 // outlet states kept, newest last (well over a second of frames)
const GRAVITY = 30 // world units/s²
const FALL_DEPTH = 7.5 // drops are gone this far below the outlet...
const FADE_DEPTH = 1.5 // ...shrinking away over the last stretch
const TIP_RING = Math.round(0.8 * (RINGS - 1)) // drops leave where the jet starts to pinch off

// Jet speed and width at the outlet for a flow q (ml/s), by continuity (q = area · speed).
const exitSpeed = (q) => 2.0 + 1.6 * Math.sqrt(q)
const exitRadius = (q) => (q > 0 ? 0.051 * Math.sqrt(q / exitSpeed(q)) : 0)
// How long the fluid stays a continuous jet before it breaks into drops: longer at a high flow.
const breakupAge = (q) => 0.05 + 0.013 * q

// A smooth random wobble (Ornstein–Uhlenbeck): drifts around 0 with the given spread,
// changing over about `period` seconds.
function wobble(period, spread, rng) {
  let value = 0
  const gauss = () => (rng() + rng() + rng() + rng() - 2) * 1.73 // ~ unit normal
  return (dt) => {
    value += -value * Math.min(1, dt / period) + spread * Math.sqrt(2 * Math.min(1, dt / period)) * gauss()
    return value
  }
}

export function createStream(rng = Math.random) {
  // Jet: RINGS rings of SIDES vertices; rings are horizontal (the jet falls nearly straight).
  const jetGeo = new THREE.BufferGeometry()
  const positions = new Float32Array(RINGS * SIDES * 3)
  jetGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  jetGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(RINGS * SIDES * 3), 3))
  const index = []
  for (let k = 0; k < RINGS - 1; k++) {
    for (let j = 0; j < SIDES; j++) {
      const a = k * SIDES + j, b = k * SIDES + ((j + 1) % SIDES)
      const c = a + SIDES, d = b + SIDES
      index.push(a, b, c, b, d, c)
    }
  }
  jetGeo.setIndex(index)
  const cos = new Float64Array(SIDES), sin = new Float64Array(SIDES)
  for (let j = 0; j < SIDES; j++) {
    cos[j] = Math.cos((j / SIDES) * Math.PI * 2)
    sin[j] = Math.sin((j / SIDES) * Math.PI * 2)
  }

  const dropGeo = new THREE.SphereGeometry(1, 8, 6)
  // A warm glow (as the original's stream had) keeps it golden in the dark, blue-lit scene.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.55, roughness: 0.04,
    clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9,
  })

  // Outlet history: time, flow, exit speed, radius, sideways velocity (x, z), ribbon angle.
  const hT = new Float64Array(HISTORY), hQ = new Float64Array(HISTORY), hV = new Float64Array(HISTORY)
  const hR = new Float64Array(HISTORY), hX = new Float64Array(HISTORY), hZ = new Float64Array(HISTORY)
  const hA = new Float64Array(HISTORY)
  const history = [hT, hQ, hV, hR, hX, hZ, hA]
  let stored = 0
  const sample = { q: 0, v: 0, r: 0, x: 0, z: 0, a: 0 }
  // Fills `sample` with the outlet's state at time `at`; `from` is where to start looking
  // back (rings ask in order of increasing age, so the search only moves one way).
  function sampleAt(at, from) {
    let i = from
    while (i > 0 && hT[i] > at) i--
    if (hT[i] > at || stored === 0) {
      sample.q = 0
      return i
    }
    const next = Math.min(stored - 1, i + 1)
    const span = hT[next] - hT[i]
    const f = span > 0 ? Math.min(1, (at - hT[i]) / span) : 0
    sample.q = hQ[i] + (hQ[next] - hQ[i]) * f
    sample.v = hV[i] + (hV[next] - hV[i]) * f
    sample.r = hR[i] + (hR[next] - hR[i]) * f
    sample.x = hX[i] + (hX[next] - hX[i]) * f
    sample.z = hZ[i] + (hZ[next] - hZ[i]) * f
    sample.a = hA[i] + (hA[next] - hA[i]) * f
    return i
  }

  const flowJitter = wobble(0.25, 0.12, rng)
  const aimX = wobble(0.3, 0.22, rng)
  const aimZ = wobble(0.35, 0.2, rng)
  const twist = wobble(1.2, 0.7, rng)
  const breakJitter = wobble(0.15, 0.03, rng)
  let jetAge = 0 // current breakup age, eased
  let spurtPhase = 0, spurtPeriod = 0.35
  let pendingDrops = 0

  // Drops: position, velocity, radius, alive.
  const drops = Array.from({ length: MAX_DROPS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, alive: false }))
  let nextDrop = 0
  function spawnDrop(x, y, z, vx, vy, vz, r) {
    const d = drops[nextDrop]
    nextDrop = (nextDrop + 1) % MAX_DROPS
    Object.assign(d, { x, y, z, vx, vy, vz, r, alive: true })
  }

  // `exit`: the outlet's position in the organ group's space. `jet`/`dropsMesh`: the meshes.
  function update(sim, dt, time, exit, jet, dropsMesh) {
    // 1. The outlet right now.
    const flowing = sim.flowRate > 0
    let q = 0
    const jitter = flowJitter(dt)
    if (flowing) {
      q = sim.flowRate * Math.max(0.3, 1 + jitter)
      if (sim.isStressLeaking) {
        // A leak escapes in spurts.
        spurtPhase += dt / spurtPeriod
        if (spurtPhase >= 1) {
          spurtPhase -= 1
          spurtPeriod = 0.28 + rng() * 0.2
        }
        q *= THREE.MathUtils.smoothstep(spurtPhase, 0, 0.12) * (1 - THREE.MathUtils.smoothstep(spurtPhase, 0.55, 0.7))
      }
    }
    const wander = 1 + 5 / (q + 1) // a weak stream wanders more
    const ax = aimX(dt), az = aimZ(dt), angle = twist(dt)
    if (stored === HISTORY) {
      for (const h of history) h.copyWithin(0, 1)
      stored--
    }
    hT[stored] = time
    hQ[stored] = q
    hV[stored] = exitSpeed(q)
    hR[stored] = exitRadius(q)
    hX[stored] = ax * wander + Math.sin(sim.sloshAngleX) * 1.2
    hZ[stored] = 0.25 + az * wander + Math.sin(sim.sloshAngleZ) * 1.2
    hA[stored] = angle
    stored++

    // 2. The jet: from the outlet down to where it breaks up. It eases toward the length
    // the current flow sustains, so when the flow stops the last of it falls away.
    const targetAge = flowing ? Math.max(0.03, breakupAge(q) + breakJitter(dt)) : 0
    jetAge += (targetAge - jetAge) * Math.min(1, dt * (targetAge > jetAge ? 8 : 2))
    let widest = 0
    let cursor = stored - 1
    let tipX = exit.x, tipY = exit.y, tipZ = exit.z, tipR = 0, tipQ = 0, tipVx = 0, tipVy = 0, tipVz = 0
    for (let k = 0; k < RINGS; k++) {
      const u = k / (RINGS - 1)
      const age = jetAge * Math.pow(u, 1.3) // denser near the outlet, where the ribbon twists
      cursor = sampleAt(time - age, cursor)
      const speed = sample.v + GRAVITY * age
      const cx = exit.x + sample.x * age
      const cy = exit.y - (sample.v * age + 0.5 * GRAVITY * age * age)
      const cz = exit.z + sample.z * age
      let r = sample.q > 0 ? sample.r * Math.sqrt(sample.v / speed) : 0
      // Swells and pinches that grow as the jet falls (they travel with the fluid).
      const growth = Math.min(0.35, 0.03 * Math.exp(age / 0.08))
      const left = (time - age) * 2 * Math.PI
      r *= 1 + growth * (0.6 * Math.sin(left * 23 + sample.a * 3) + 0.4 * Math.sin(left * 37 - sample.a * 5))
      r *= 1 - THREE.MathUtils.smoothstep(u, 0.8, 1) // pinches off at the tip
      // Ribbon: the slit-shaped opening flattens the jet, the flat side flipping as it falls.
      const e = 0.38 * Math.cos((age / 0.06) * 2 * Math.PI) * Math.exp(-age / 0.12)
      const theta = sample.a + age * 6
      const ct = Math.cos(theta), st = Math.sin(theta)
      const ra = r * (1 + e), rb = r * (1 - e)
      for (let j = 0; j < SIDES; j++) {
        const lx = ra * cos[j], lz = rb * sin[j]
        const o = (k * SIDES + j) * 3
        positions[o] = cx + lx * ct - lz * st
        positions[o + 1] = cy
        positions[o + 2] = cz + lx * st + lz * ct
      }
      widest = Math.max(widest, r)
      if (k === TIP_RING) {
        tipX = cx; tipY = cy; tipZ = cz; tipR = sample.q > 0 ? sample.r * Math.sqrt(sample.v / speed) : 0
        tipQ = sample.q; tipVx = sample.x; tipVy = -speed; tipVz = sample.z
      }
    }
    if (jet) {
      jet.visible = widest > 0.002
      if (jet.visible) {
        jetGeo.attributes.position.needsUpdate = true
        computeNormals(jetGeo)
      }
    }

    // 3. Drops leave the tip (or the outlet itself when it only dribbles), a few with a
    // small satellite, and fall away.
    pendingDrops += tipQ * 5 * dt
    while (pendingDrops >= 1) {
      pendingDrops -= 1
      const r = Math.max(0.01, tipR * (1.1 + rng() * 0.6))
      const spread = 0.35 + 0.6 / (tipQ + 1)
      spawnDrop(tipX, tipY, tipZ, tipVx + (rng() - 0.5) * spread, tipVy, tipVz + (rng() - 0.5) * spread, r)
      if (rng() < 0.3) spawnDrop(tipX, tipY + r, tipZ, tipVx + (rng() - 0.5) * spread * 2, tipVy * 0.95, tipVz + (rng() - 0.5) * spread * 2, r * 0.35)
    }
    if (!dropsMesh) return
    const m = dropsMesh.instanceMatrix.array
    let alive = 0
    const floor = exit.y - FALL_DEPTH
    for (const d of drops) {
      if (!d.alive) continue
      d.vy -= GRAVITY * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z += d.vz * dt
      if (d.y < floor) {
        d.alive = false
        continue
      }
      // Fast drops stretch a little; they shrink away near the bottom.
      const s = d.r * Math.min(1, (d.y - floor) / FADE_DEPTH)
      const stretch = 1 + Math.min(0.5, -d.vy * 0.02)
      const o = alive * 16
      m.fill(0, o, o + 16)
      m[o] = s
      m[o + 5] = s * stretch
      m[o + 10] = s
      m[o + 12] = d.x
      m[o + 13] = d.y
      m[o + 14] = d.z
      m[o + 15] = 1
      alive++
    }
    dropsMesh.count = alive
    dropsMesh.visible = alive > 0
    dropsMesh.instanceMatrix.needsUpdate = true
  }

  // Urine colour by hydration (0.3 dehydrated .. 1 well hydrated): amber to pale straw.
  const amber = new THREE.Color().setRGB(0.95, 0.55, 0.05, THREE.SRGBColorSpace)
  const straw = new THREE.Color().setRGB(1.0, 0.86, 0.22, THREE.SRGBColorSpace)
  function setHydration(h) {
    material.color.lerpColors(amber, straw, THREE.MathUtils.clamp((h - 0.3) / 0.7, 0, 1))
  }

  return { jetGeo, dropGeo, material, maxDrops: MAX_DROPS, update, setHydration }
}
