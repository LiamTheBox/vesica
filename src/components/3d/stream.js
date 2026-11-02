import * as THREE from 'three'
import { computeNormals } from './normals'

// The urine stream (requested: one narrow opening, not a nozzle, and less uniform, but with
// the strength of a hose). A jet shoots from inside the urethral opening, fast and nearly
// straight at a strong flow, its surface streaked with light that races down with the
// fluid, swells and pinches along its length, and bursts into a spray. Its flow, aim and
// twist wander all the time, and every wobble travels down the jet with the fluid: each ring
// of the jet is drawn from the outlet's state at the moment that fluid left it. A weak
// stream is slow, wanders and twists like a ribbon (the opening is a slit, so the jet's
// cross-section flips back and forth). Leaks come out in spurts; the end of a void dribbles.

const RINGS = 48
const SIDES = 12
const MAX_DROPS = 200
const HISTORY = 160 // outlet states kept, newest last (well over a second of frames)
const GRAVITY = 30 // world units/s²
const FALL_DEPTH = 16 // drops are gone this far below the outlet...
const FADE_DEPTH = 3 // ...shrinking away over the last stretch
const TIP_RING = Math.round(0.8 * (RINGS - 1)) // drops leave where the jet starts to pinch off
const INSIDE = 0.25 // the jet starts this far up the urethra, so it comes out of the opening

// Jet speed and width at the outlet for a flow q (ml/s): a dribble is slow and thin, and a
// strong flow is fast and fills the opening, which it can't outgrow (its radius, open).
const OPENING = 0.2
const exitSpeed = (q) => Math.min(70, 1.5 + 4.5 * Math.sqrt(q))
const exitRadius = (q) => (q > 0 ? OPENING * Math.sqrt(q / (q + 50)) : 0)
// How far the fluid stays a continuous jet before it breaks into drops: further at a high
// flow, though never off the bottom of the screen, where nobody would see it burst.
const jetLength = (q) => (7 * q) / (q + 30)
const breakupAge = (q) => jetLength(q) / exitSpeed(q)
// How far it wanders off straight, in radians: much more for a weak stream.
const wanderOf = (q) => 1 + 5 / (q + 1)
const AIM_SPREAD = 0.025
const FLUTTER_SPREAD = 0.012
const SLOSH_AIM = 0.05
const FORWARD_AIM = 0.012

// The jet's surface: it needs light moving on it to look fast. Everything's drawn from when
// this fluid left the opening, so the streaks race down the jet with it, whatever its speed:
// long down the jet, narrow around it, at no more than 20 passes a second, or the frames
// would catch them going backward. The middle of the column glows, its edges are deeper,
// and air whipped in pales it toward the end, where it frays.
const jetVertex = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  attribute vec2 aDir;
  attribute vec2 aFlow;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vDir;
  varying vec2 vFlow;
  void main() {
    #include <begin_vertex>
    #include <project_vertex>
    vN = normalMatrix * normal;
    vView = -mvPosition.xyz;
    vDir = aDir;
    vFlow = aFlow;
    #include <fog_vertex>
  }
`
const jetFragment = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vDir;
  varying vec2 vFlow;
  void main() {
    vec3 n = normalize(vN);
    float facing = abs(dot(n, normalize(vView)));
    float around = atan(vDir.y, vDir.x); // sin(k * around) has no seam, for a whole k
    float left = vFlow.x * 6.2832;
    float along = vFlow.y;
    float a = sin(around * 3.0 + left * 7.0 + 1.6 * sin(left * 2.3 + around));
    float b = sin(around * 5.0 - left * 11.0 + 1.4 * sin(left * 3.7 - around * 2.0));
    float c = sin(around * 2.0 + left * 17.0);
    float streak = smoothstep(0.5, 1.0, a) * 0.6 + smoothstep(0.65, 1.0, b) * 0.5 + smoothstep(0.8, 1.0, c) * 0.3;
    vec3 col = mix(uColor * 0.32, uColor, smoothstep(0.05, 0.75, facing));
    float glint = pow(max(dot(n, normalize(vec3(0.35, 0.45, 0.82))), 0.0), 14.0);
    col = mix(col, vec3(1.0, 0.9, 0.55), clamp(streak * 0.6 + glint * 0.45, 0.0, 1.0));
    float frayed = smoothstep(0.5, 1.0, along);
    col = mix(col, vec3(1.0, 0.92, 0.65), frayed * (0.1 + 0.5 * streak));
    float tip = smoothstep(1.0, 0.8, along + 0.2 * (0.5 + 0.5 * a));
    gl_FragColor = vec4(col, mix(0.97, 0.75, frayed) * tip);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

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
  const flow = new Float32Array(RINGS * SIDES * 2) // when it left the opening (s), how far along the jet (0..1)
  const around = new Float32Array(RINGS * SIDES * 2)
  jetGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  jetGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(RINGS * SIDES * 3), 3))
  jetGeo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 2))
  jetGeo.setAttribute('aDir', new THREE.BufferAttribute(around, 2))
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
  for (let v = 0; v < RINGS * SIDES; v++) {
    around[v * 2] = cos[v % SIDES]
    around[v * 2 + 1] = sin[v % SIDES]
  }

  const dropGeo = new THREE.SphereGeometry(1, 8, 6)
  // Its own light rather than the scene's, so it stays golden in the dark, blue-lit scene.
  const color = new THREE.Color(0xfacc15)
  const jetMaterial = new THREE.ShaderMaterial({
    vertexShader: jetVertex,
    fragmentShader: jetFragment,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uColor: { value: color } },
    transparent: true,
    depthWrite: false, // its frayed end fades out, and shouldn't hide what's behind it
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  })
  const dropMaterial = new THREE.MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.92, toneMapped: false })

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
  const aimX = wobble(0.3, AIM_SPREAD, rng)
  const aimZ = wobble(0.35, AIM_SPREAD, rng)
  const flutterX = wobble(0.05, FLUTTER_SPREAD, rng)
  const flutterZ = wobble(0.05, FLUTTER_SPREAD, rng)
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
  // `growth`: how far an overfilled bladder has made the view back off, so the jet still
  // reaches as far down the screen.
  function update(sim, dt, time, exit, jet, dropsMesh, growth = 1) {
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
    const speedNow = exitSpeed(q)
    const wander = wanderOf(q) * speedNow
    const ax = aimX(dt) + flutterX(dt), az = aimZ(dt) + flutterZ(dt), angle = twist(dt)
    if (stored === HISTORY) {
      for (const h of history) h.copyWithin(0, 1)
      stored--
    }
    hT[stored] = time
    hQ[stored] = q
    hV[stored] = speedNow
    hR[stored] = exitRadius(q)
    hX[stored] = ax * wander + Math.sin(sim.sloshAngleX) * SLOSH_AIM * speedNow
    hZ[stored] = (FORWARD_AIM + Math.sin(sim.sloshAngleZ) * SLOSH_AIM) * speedNow + az * wander
    hA[stored] = angle
    stored++

    // 2. The jet: from the outlet down to where it breaks up. It eases toward the length
    // the current flow sustains, so when the flow stops the last of it falls away.
    const targetAge = flowing ? Math.max(0.03, breakupAge(q) * growth + breakJitter(dt)) : 0
    jetAge += (targetAge - jetAge) * Math.min(1, dt * (targetAge > jetAge ? 30 : 2))
    let widest = 0
    let cursor = stored - 1
    let tipX = exit.x, tipY = exit.y, tipZ = exit.z, tipR = 0, tipQ = 0, tipVx = 0, tipVy = 0, tipVz = 0
    for (let k = 0; k < RINGS; k++) {
      const u = k / (RINGS - 1)
      const age = jetAge * Math.pow(u, 1.3) // denser near the outlet, where the ribbon twists
      cursor = sampleAt(time - age, cursor)
      const speed = sample.v + GRAVITY * age
      const cx = exit.x + sample.x * age
      const cy = exit.y + INSIDE - (sample.v * age + 0.5 * GRAVITY * age * age)
      const cz = exit.z + sample.z * age
      let r = sample.q > 0 ? sample.r * Math.sqrt(sample.v / speed) : 0
      // Swells and pinches that grow as the jet falls (they travel with the fluid).
      const bulge = Math.min(0.35, 0.03 * Math.exp(age / 0.08))
      const left = (time - age) * 2 * Math.PI
      r *= 1 + bulge * (0.6 * Math.sin(left * 9 + sample.a * 3) + 0.4 * Math.sin(left * 14 - sample.a * 5))
      // A weak jet pinches off at the tip; a strong one frays out at full width (in the shader).
      r *= 1 - (1 - 0.6 * THREE.MathUtils.smoothstep(sample.q, 10, 60)) * THREE.MathUtils.smoothstep(u, 0.8, 1)
      // Ribbon: the slit-shaped opening flattens the jet, the flat side flipping as it falls.
      // A strong flow forces it nearly round.
      const e = (0.05 + (1.7 / (sample.q + 5))) * Math.cos((age / 0.06) * 2 * Math.PI) * Math.exp(-age / 0.12)
      const theta = sample.a + age * 6
      const ct = Math.cos(theta), st = Math.sin(theta)
      const ra = r * (1 + e), rb = r * (1 - e)
      for (let j = 0; j < SIDES; j++) {
        const lx = ra * cos[j], lz = rb * sin[j]
        const o = (k * SIDES + j) * 3
        positions[o] = cx + lx * ct - lz * st
        positions[o + 1] = cy
        positions[o + 2] = cz + lx * st + lz * ct
        const f = (k * SIDES + j) * 2
        flow[f] = (time - age) % 256
        flow[f + 1] = u
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
        jetGeo.attributes.aFlow.needsUpdate = true
        computeNormals(jetGeo)
      }
    }

    // 3. Drops leave the tip (or the outlet itself when it only dribbles), a few with a
    // small satellite, and fall away.
    pendingDrops += Math.min(tipQ, 60) * 5 * dt
    while (pendingDrops >= 1) {
      pendingDrops -= 1
      // It bursts into a spray of fine drops and a few big ones: the faster it's going, the
      // wider. A dribble only drips, in big drops.
      const fast = THREE.MathUtils.smoothstep(tipQ, 4, 30)
      const big = rng() < 0.12
      const r = Math.max(0.012, tipR * THREE.MathUtils.lerp(1.1 + rng() * 0.6, big ? 0.55 : 0.14 + rng() * 0.2, fast))
      const spread = 0.35 + 0.6 / (tipQ + 1) + 0.12 * -tipVy
      const drag = 0.75 + 0.35 * rng()
      const vx = tipVx + (rng() - 0.5) * spread, vy = tipVy * drag, vz = tipVz + (rng() - 0.5) * spread
      // Each already a part of the frame on its way, or a slow frame would release them in clumps.
      const ahead = rng() * dt
      spawnDrop(tipX + vx * ahead, tipY + vy * ahead, tipZ + vz * ahead, vx, vy, vz, r)
    }
    if (!dropsMesh) return
    const m = dropsMesh.instanceMatrix.array
    let alive = 0
    const floor = exit.y - FALL_DEPTH * growth
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
      // Fast drops streak; they shrink away near the bottom.
      const s = d.r * Math.min(1, (d.y - floor) / FADE_DEPTH)
      const stretch = 1 + Math.min(4, -d.vy * 0.1)
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
  const amber = new THREE.Color().setRGB(0.95, 0.5, 0.03, THREE.SRGBColorSpace)
  const straw = new THREE.Color().setRGB(1.0, 0.78, 0.1, THREE.SRGBColorSpace)
  function setHydration(h) {
    color.lerpColors(amber, straw, THREE.MathUtils.clamp((h - 0.3) / 0.7, 0, 1))
    dropMaterial.color.copy(color)
  }

  return { jetGeo, dropGeo, jetMaterial, dropMaterial, maxDrops: MAX_DROPS, update, setHydration }
}
