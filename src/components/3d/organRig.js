import * as THREE from 'three'
import { physicsOf } from '../../sim/sim'
import { BLUSH_COLOR, createBodyLanguage, WALL_EMISSIVE } from './bodyLanguage'
import { computeNormals } from './normals'
import {
  BLADDER_VERTICES, BOUNDS_RADIUS, createOrganGeometry, DOME_BASE_Y, DOME_TOP_Y, FLUID_INSET, INFLATION_SANDBOX_MOST,
  inflationOf, NECK_GAP, NECK_ROWS, NECK_TOP_Y, NECK_WIDTH, ORGAN_CENTER, orientCutaway, OUTLET_Y, RADIAL, RING_VERTICES,
  ringWeight, SANDBOX_MOST, SPHINCTER_FOLDS, urethraWeight, urineScale, weldSeam,
} from './organGeometry'
import { createStream } from './stream'
import { createUreter } from './ureter'

// Per-frame deformation of the organ (its shape at rest is organGeometry.js). Kept outside
// React so the 60 fps vertex work never touches component render; `Organ.jsx` wires it up.
// The per-frame loops work on the raw attribute arrays with per-vertex constants
// precomputed, and allocate nothing (M7).

// Impact profiles from the original pokeBladder() / slapBladder().
const POKE = { radius: 1.4, powerScale: 1.0, velScale: 1.6, dentGain: 0.35, dentCap: 0.6 }
const SLAP = { radius: 1.8, powerScale: 2.2, velScale: 1.0, dentGain: 0.4, dentCap: 0.8 }

// How the wall feels with fill, from slack to full: slack it's soft (deep dents, slow
// springs, a floppy wobble, ripples that die out), full it's taut (shallow dents that
// spring back fast, a tight wobble, ripples that carry).
const FEEL = {
  dent: [1.4, 0.55], // times the impact profiles' push and dent (never deeper than their cap)
  spring: [0.7, 1.5], // times the physics preset's spring
  wobble: [1.3, 0.7], // times the jiggle
  ripple: [0.7, 1.35], // times the ripples' height
}
const feel = (key, fill) => THREE.MathUtils.lerp(FEEL[key][0], FEEL[key][1], Math.min(1, fill))

// Filling, like an anatomy book's empty and full bladders (requested): nearly empty it
// sags flat on top (sagFactor); filling past a third, the dome rises and the lower body
// fills out toward a ball.
const DOME_RISE = 0.2 // the dome's extra height when full, as a share of its height
const BELLY = 0.1 // the lower body's extra width when full, at its fullest
// The urine shrinks toward this point, low in the sac, so what's left pools by the neck.
const URINE_PIVOT_Y = -0.8

// Detrusor contraction, in urge waves and while voiding: its muscle bundles stand out, and
// the dome pushes down from the top (requested, like the book's emptying bladder). In an
// urge wave it comes down a little and the sides bulge, since nothing can get out; while
// voiding the wall tightens and the dome pushes right down into a hollow, pressing the
// urine out, a little harder with each push.
const CONTRACT_TIGHTEN = 0.04
const CONTRACT_BUNDLES = 0.03
const DOME_PUSH = { urge: 0.3, void: 0.62 } // how far the top comes down, as a share of the dome's height
const DOME_HEIGHT = DOME_TOP_Y - DOME_BASE_Y
const PUSH_SECONDS = 1.6 // one push while voiding
const PUSH_PULSE = 0.15 // how much each push adds
const URGE_BULGE = 0.1 // the sides' extra width for what the dome pushes in, in an urge wave

// A slack bladder folds like a deflated balloon: soft pleats gathered toward the neck, like
// a balloon's toward its knot, and a few broad crumples. They pull out as it fills, and
// as it contracts.
const PLEATS = 7
const PLEAT_DEPTH = 0.12
const CRUMPLE_DEPTH = 0.08

// A squirt from a ureter kicks the wall out where it comes in (the springs make the gulp),
// and sends a ripple across the urine from there: a dip, so the urine never reaches past
// the wall.
const SQUIRT = { radius: 1.1, kick: 0.9 }
const INFLOW_SECONDS = 1.6
const INFLOW_RIPPLE = 0.04
const RIPPLE_SPEED = 2.4

export function createOrganRig() {
  const { geometry: bladderGeo, profile, rings } = createOrganGeometry()
  const bPos = bladderGeo.attributes.position
  const bColor = bladderGeo.attributes.color

  // The soft-body wall is the bladder's rows; the sphincter's rows below follow its neck.
  const count = BLADDER_VERTICES
  const wall = bPos.array
  const baseVertices = []
  for (let i = 0; i < count; i++) baseVertices.push(new THREE.Vector3(bPos.getX(i), bPos.getY(i), bPos.getZ(i)))
  const base = new Float32Array(wall.subarray(0, count * 3)) // rest shape
  const velocity = new Float64Array(count * 3)
  const dentMemory = new Float32Array(count)

  // The urine: the wall's shape, closed off at the neck, scaled to the volume held.
  const urineGeo = bladderGeo.clone()
  urineGeo.boundingSphere = bladderGeo.boundingSphere.clone()
  const urinePos = urineGeo.attributes.position.array

  // Per-vertex constants of the deformation below, so a frame only does multiply-adds.
  const slump = new Float64Array(count) // how much of the flaccid spread this vertex takes
  const pin = new Float64Array(count) // how much this vertex keeps the neck's width
  const solid = new Float64Array(count) // how opaque, toward the solid neck
  const bundle = new Float64Array(count) // detrusor bundles, -0.5..0.5
  const balloon = new Float64Array(count) // deflated-balloon folds: radius change when fully slack
  const dome = new Float64Array(count) // height above the dome's base, which rises when full
  const belly = new Float64Array(count) // where the lower body fills out when full, 0..1
  const push = new Float64Array(count) // how far the dome's push moves this vertex down, 0..1
  const jiggleS3 = new Float64Array(count) // sin 3θ · sin 2φ
  const jiggleC3 = new Float64Array(count) // cos 3θ · sin 2φ
  const jiggleC2 = new Float64Array(count) // cos 2θ
  const jiggleS2 = new Float64Array(count) // sin 2θ
  for (let i = 0; i < count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]
    const u = rings[Math.floor(i / RING_VERTICES)] // 0 at the top, 1 at the neck
    const sy = y / 2.35
    // A slack bladder spreads around its middle as the dome sags onto it, fading out
    // smoothly toward the dome and the neck.
    slump[i] = 1.0 - THREE.MathUtils.smootherstep(Math.abs(sy), 0.15, 0.95)
    pin[i] = THREE.MathUtils.smoothstep(u, 0.8, 0.97)
    solid[i] = THREE.MathUtils.smoothstep(u, 0.86, 1.1)
    const theta = ((i % RING_VERTICES) / RADIAL) * Math.PI * 2
    // Two families of oblique bands that cross in a meshwork, like the detrusor's bundles.
    const b1 = Math.sin(theta * 5.0 + sy * 4.0)
    const b2 = Math.sin(theta * 5.0 - sy * 4.0)
    bundle[i] = (b1 * b1 + b2 * b2) / 2 - 0.5
    // Pleats: sharp creases between soft ridges, wavering a little on their way up from
    // the neck and fading out near the top of the dome; then the crumples.
    const w = theta * PLEATS + 0.7 * Math.sin(sy * 3.0 + theta * 2.0)
    const pleat = (2 * Math.abs(Math.sin(w / 2)) - 1) * (1 - THREE.MathUtils.smoothstep(sy, 0.25, 1.0)) * (1 - 0.7 * pin[i])
    const crumple = Math.sin(x * 1.3 + y * 1.9 + 0.7) * Math.sin(z * 1.7 - y * 1.1 + 2.1) + 0.6 * Math.sin(x * 2.3 - z * 1.7 + y * 1.3 + 0.4)
    balloon[i] = PLEAT_DEPTH * pleat + CRUMPLE_DEPTH * crumple / 1.6
    // Both ease in, so the full shape has no crease where they start.
    const up = y - DOME_BASE_Y + 0.5
    dome[i] = up <= 0 ? 0 : up < 1 ? (up * up) / 2 : up - 0.5
    const below = THREE.MathUtils.clamp((DOME_BASE_Y - y) / (DOME_BASE_Y + 2.0), 0, 1)
    belly[i] = 16 * below * below * (1 - below) * (1 - below) * (1 - pin[i])
    // The middle of the top comes down furthest and the sides hardly at all, a valley from
    // front to back, so the top dips in seen from the front, as in the book.
    const across = Math.min(1, Math.abs(x) / 2.1)
    push[i] = (1 - across * across) ** 2 * THREE.MathUtils.smoothstep(y, 0.1, 1.0)
    const sin2phi = Math.sin(Math.acos(Math.max(-1, Math.min(1, y / 2.35))) * 2.0)
    jiggleS3[i] = Math.sin(theta * 3.0) * sin2phi
    jiggleC3[i] = Math.cos(theta * 3.0) * sin2phi
    jiggleC2[i] = Math.cos(theta * 2.0)
    jiggleS2[i] = Math.sin(theta * 2.0)
  }

  // The sphincter's rows: r, y, x and z of the direction out, fold pattern, sin 4θ, cos 4θ,
  // ring weight, urethra weight per vertex.
  const sCount = NECK_ROWS * RING_VERTICES
  const sphincterBase = new Float64Array(sCount * 9)
  for (let j = 0; j < sCount; j++) {
    const { x: r, y } = profile[Math.floor(j / RING_VERTICES)]
    const theta = ((j % RING_VERTICES) / RADIAL) * Math.PI * 2
    sphincterBase.set([
      r, y, -Math.cos(theta), Math.sin(theta), Math.sin(theta * SPHINCTER_FOLDS),
      Math.sin(theta * 4.0), Math.cos(theta * 4.0), ringWeight(y), urethraWeight(y),
    ], j * 9)
  }
  let clenchLevel = 0 // eases in and out rather than snapping
  let contraction = 0 // detrusor, 0..1
  let domePush = 0 // the dome's push, as a share of its height
  let pushPhase = 0
  let wallAlpha = -1
  let lastFill = 0.16 // for impacts, which come between frames
  const body = createBodyLanguage()

  const stream = createStream()
  const outlet = new THREE.Vector3()
  const neck = new THREE.Vector3()
  const cutCenter = new THREE.Vector3()

  const ureters = [createUreter(-1, baseVertices), createUreter(1, baseVertices)]
  // Each vertex's rest distance from each ureter's opening, and the time since its last squirt.
  const fromOpening = ureters.map(({ endIndex }) => Float64Array.from(baseVertices, (v) => v.distanceTo(baseVertices[endIndex])))
  const inflowAge = [Infinity, Infinity]
  const rippleAt = new Float64Array(2)
  const rippleHeight = new Float64Array(2)

  const cutawayPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)

  const scratch = new THREE.Vector3()
  const wallPoint = new THREE.Vector3()
  const wallNormal = new THREE.Vector3()

  // Pushes vertices near `local` inward and leaves a slowly recovering dent: deeper the
  // slacker the wall.
  function impact(local, strength, profile) {
    const give = feel('dent', lastFill)
    for (let i = 0; i < count; i++) {
      const vx = wall[i * 3], vy = wall[i * 3 + 1], vz = wall[i * 3 + 2]
      const d = scratch.set(vx, vy, vz).distanceTo(local)
      if (d < profile.radius) {
        const power = (1.0 - d / profile.radius) * strength * profile.powerScale * give
        velocity[i * 3] -= (vx / 2.35) * power * profile.velScale
        velocity[i * 3 + 1] -= (vy / 2.35) * power * profile.velScale
        velocity[i * 3 + 2] -= (vz / 2.35) * power * profile.velScale
        dentMemory[i] = Math.min(profile.dentCap * Math.min(1, give), dentMemory[i] + power * profile.dentGain)
      }
    }
  }

  // Pushes the wall out around ureter k's opening.
  function squirt(k) {
    const near = fromOpening[k]
    for (let i = 0; i < count; i++) {
      if (near[i] >= SQUIRT.radius) continue
      const push = (1.0 - near[i] / SQUIRT.radius) * SQUIRT.kick / 2.35
      velocity[i * 3] += wall[i * 3] * push
      velocity[i * 3 + 1] += wall[i * 3 + 1] * push
      velocity[i * 3 + 2] += wall[i * 3 + 2] * push
    }
  }

  const poke = (local, strength) => impact(local, strength, POKE)
  const slap = (local, strength) => impact(local, strength, SLAP)
  const clearDents = () => dentMemory.fill(0)

  // `objects`: live meshes/materials from Organ.jsx refs (`body`: the group the organ's body
  // language moves), the camera, how the bladder feels (`mood`, for its breathing, slump
  // and blush; without one it holds still), whether the player asked for reduced motion
  // (`reducedMotion`: smaller shakes), and what to call when a ureter squirts
  // (onSquirt(side), -1 left, 1 right).
  function update(sim, dt, timeSec, objects) {
    const { wallMat, urine, camera, cutaway } = objects
    const phys = physicsOf(sim)

    const fillRatio = Math.max(0.01, sim.volume / sim.maxCapacity)
    lastFill = fillRatio
    const compY = sim.squeezeAmountY || 0
    const scaleY = 1.0 - compY
    const inflationScale = inflationOf(fillRatio)
    // Overfilled past the sandbox's most (the arcade), the shape stays the same and grows.
    const shapeFill = Math.min(fillRatio, SANDBOX_MOST)
    const growth = Math.max(1, inflationScale / INFLATION_SANDBOX_MOST)
    bladderGeo.boundingSphere.radius = urineGeo.boundingSphere.radius = BOUNDS_RADIUS * growth

    // The cut runs down through the neck, so it halves the sphincter and the urethra too.
    if (cutaway && camera) orientCutaway(cutawayPlane, camera.position, cutCenter.set(0, ORGAN_CENTER.y, 0))

    // The detrusor contracts in an urge wave (involuntarily) and while voiding, and the dome
    // pushes down: in pushes while voiding.
    const voiding = sim.isActivelyVoiding || sim.involuntaryVoiding
    const spasm = Math.min(1, sim.detrusorSpasmIntensity)
    contraction += ((voiding ? 1 : spasm) - contraction) * Math.min(1, dt * 4)
    pushPhase = voiding ? (pushPhase + dt / PUSH_SECONDS) % 1 : 0
    const pushTarget = voiding ? DOME_PUSH.void * (1 - PUSH_PULSE * (0.5 + 0.5 * Math.cos(pushPhase * Math.PI * 2))) : DOME_PUSH.urge * spasm
    domePush += (pushTarget - domePush) * Math.min(1, dt * 3)
    const pushDepth = domePush * DOME_HEIGHT
    const urgeBulge = voiding ? 0 : URGE_BULGE * Math.min(1, domePush / DOME_PUSH.urge)

    const mood = objects.mood
    body.step(sim, dt, mood)

    // A stretched wall is thinner, so more of the liquid shows through; a contracting
    // one thickens and flushes.
    const stretch = Math.min(1.0, fillRatio)
    if (wallMat) {
      // Strained muscle throbs red, as in the original, but only once the sphincter is at
      // 100 % (requested).
      const strainPulse = sim.sphincterToneStrain >= 1 ? Math.sin(timeSec * 15.0) * 0.35 + 0.35 : 0
      wallMat.emissiveIntensity = 0.08 + stretch * 0.14 + strainPulse + contraction * 0.3 + body.flash * 0.6 + body.blush * 0.35
      wallMat.emissive.copy(WALL_EMISSIVE).lerp(BLUSH_COLOR, body.blush)
      wallMat.roughness = THREE.MathUtils.lerp(0.55, 0.45, stretch)
    }
    // Toward the neck it turns solid, like the sphincter below it.
    const alpha = THREE.MathUtils.lerp(0.64, 0.3, stretch) + contraction * 0.18
    if (Math.abs(alpha - wallAlpha) > 0.004) {
      wallAlpha = alpha
      for (let i = 0; i < count; i++) bColor.array[i * 4 + 3] = alpha + (1 - alpha) * solid[i]
      bColor.needsUpdate = true
    }
    // Urine colour follows hydration, in the bladder and in the stream: straw yellow, paler
    // the better hydrated, and amber when not.
    const h = sim.hydration
    if (objects.fluidMat) objects.fluidMat.color.setRGB(1.0, 0.66 + h * 0.2, 0.06 + h * 0.3)
    stream.setHydration(h)

    // Soft-body wall
    const phase = sim.globalJigglePhase
    const wobble = sim.jiggleIntensity * feel('wobble', fillRatio)
    const jiggle1 = Math.sin(phase) * wobble * 0.18
    const jiggle2 = Math.cos(phase * 1.5) * wobble * 0.12
    // sin(3θ + phase)·sin 2φ·j1 + cos(2θ − 1.2 phase)·j2, expanded with the angle-sum identities
    const jA = Math.cos(phase) * jiggle1
    const jB = Math.sin(phase) * jiggle1
    const jC = Math.cos(phase * 1.2) * jiggle2
    const jD = Math.sin(phase * 1.2) * jiggle2
    const bulgeXZ = Math.sqrt(1.0 / Math.max(0.2, (1.0 - compY * (0.45 + shapeFill * 0.45))))
    // A contracting bladder is taut: it stops sagging and slumping.
    const relaxed = 1.0 - contraction
    const sagFactor = Math.max(0, (1.0 - fillRatio * 2.2)) * 0.3 * relaxed
    const full = THREE.MathUtils.smoothstep(Math.min(1, shapeFill), 0.35, 1.0)
    const domeRise = DOME_RISE * full
    const bellyOut = BELLY * full
    const sloshX = Math.sin(sim.sloshAngleX) * 0.22
    const sloshZ = Math.sin(sim.sloshAngleZ) * 0.22
    const coreX = sim.fluidCoreOffset.x * 0.35
    const coreZ = sim.fluidCoreOffset.z * 0.35
    const slackSpread = (1.0 - shapeFill) * 0.12 * relaxed
    const ripples = sim.ripples
    const springDt = phys.springK * feel('spring', fillRatio) * dt
    const rippleGain = feel('ripple', fillRatio)
    const damping = phys.damping
    const tighten = 1.0 - CONTRACT_TIGHTEN * (voiding ? contraction : 0)
    const bundles = CONTRACT_BUNDLES * contraction
    const deflated = Math.pow(1.0 - Math.min(1.0, fillRatio), 1.4) * relaxed
    // Squirts arriving: the ripple's reach and height from each opening.
    let inflow = false
    rippleHeight.fill(0)
    for (let k = 0; k < 2; k++) {
      inflowAge[k] += dt
      if (inflowAge[k] >= INFLOW_SECONDS) continue
      inflow = true
      rippleAt[k] = RIPPLE_SPEED * inflowAge[k]
      rippleHeight[k] = INFLOW_RIPPLE * Math.exp(-2.2 * inflowAge[k])
    }

    // Water balloon: liquid can't compress, so whatever a dent pushes in bulges out
    // everywhere else. A mean radial dent m loses ~3m of volume; scaling by (1 + m)
    // puts it back.
    let dentSum = 0
    for (let i = 0; i < count; i++) {
      dentMemory[i] = Math.max(0, dentMemory[i] - dt * 1.4)
      dentSum += dentMemory[i]
    }
    const balloonBulge = 1.0 + dentSum / count

    for (let i = 0; i < count; i++) {
      const o = i * 3
      const bx = base[o], by = base[o + 1], bz = base[o + 2]
      const yNorm = by / 2.35

      const sloshPushX = sloshX * yNorm + coreX
      const sloshPushZ = sloshZ * yNorm + coreZ
      const jiggleWobble = jiggleS3[i] * jA + jiggleC3[i] * jB + jiggleC2[i] * jC + jiggleS2[i] * jD

      let rippleDisp = 0
      for (let r = 0; r < ripples.length; r++) {
        const rip = ripples[r]
        const dx = bx - rip.center.x, dy = by - rip.center.y, dz = bz - rip.center.z
        const waveDist = Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - rip.radius)
        if (waveDist < 0.65) rippleDisp += Math.cos((waveDist / 0.65) * (Math.PI / 2)) * rip.amplitude * rippleGain
      }

      const contract = contraction > 0.001 ? tighten + bundles * bundle[i] : 1.0

      const sagY = by > 0 ? -sagFactor * yNorm : 0
      const flaccidSpread = 1.0 + slackSpread * slump[i]
      let ripple = 0
      if (inflow) {
        for (let k = 0; k < 2; k++) {
          const w = (fromOpening[k][i] - rippleAt[k]) / 0.35
          ripple += rippleHeight[k] * Math.exp(-w * w)
        }
      }

      const totalRadMod = Math.max(0.2, (1.0 + jiggleWobble + rippleDisp - dentMemory[i] + deflated * balloon[i])) * balloonBulge * contract

      // Width around the neck's axis: the lower body fills out when full and bulges while the
      // dome pushes against a closed outlet; the funnel keeps the neck's width.
      const width = THREE.MathUtils.lerp(flaccidSpread * bulgeXZ * inflationScale * (1 + bellyOut * belly[i] + urgeBulge * (1 - push[i])), NECK_WIDTH, pin[i])
      const lift = domeRise * dome[i] - pushDepth * push[i]
      const tx = (bx * width + sloshPushX) * totalRadMod
      const ty = ((by + lift) * scaleY + sagY) * inflationScale * totalRadMod
      const tz = (bz * width + sloshPushZ) * totalRadMod

      const cx = wall[o], cy = wall[o + 1], cz = wall[o + 2]
      const vx = (velocity[o] + (tx - cx) * springDt) * damping
      const vy = (velocity[o + 1] + (ty - cy) * springDt) * damping
      const vz = (velocity[o + 2] + (tz - cz) * springDt) * damping
      velocity[o] = vx; velocity[o + 1] = vy; velocity[o + 2] = vz
      wall[o] = cx + vx * dt
      wall[o + 1] = cy + vy * dt
      wall[o + 2] = cz + vz * dt
      // The urine: the wall's own smooth shape, dipping where a squirt's ripple passes.
      const fold = 1.0 - ripple
      urinePos[o] = wall[o] * fold
      urinePos[o + 1] = wall[o + 1] * fold
      urinePos[o + 2] = wall[o + 2] * fold
    }

    // The neck: the centre of the bladder's last ring, wherever the wall has carried it.
    neck.set(0, 0, 0)
    for (let i = count - RING_VERTICES; i < count - 1; i++) neck.add(scratch.fromArray(wall, i * 3))
    neck.divideScalar(RADIAL)
    const neckTop = neck.y - NECK_GAP

    // Body language moves the whole organ about the neck.
    body.pose(sim, neck, timeSec, mood, objects.reducedMotion)
    if (objects.body) {
      objects.body.scale.copy(body.scale)
      objects.body.position.copy(body.offset)
    }

    // Sphincter: a clench clamps the ring and deepens its folds, voiding opens it all
    // up, and strain makes it twitch (the rippling shake of the original's tube).
    const dil = sim.isStressLeaking ? 0.35 : sim.sphincterDilation
    const twitchOsc = Math.sin(timeSec * 38.0) * Math.cos(timeSec * 23.0)
    const twitch = sim.sphincterToneStrain * 0.08 * twitchOsc
    const s30 = Math.sin(timeSec * 30.0), c30 = Math.cos(timeSec * 30.0)
    clenchLevel += ((sim.isClenching ? 1 : 0) - clenchLevel) * Math.min(1, dt * 14)
    const foldDepth = (0.02 + 0.03 * clenchLevel) * (1.0 - dil)
    for (let j = 0; j < sCount; j++) {
      const k = j * 9
      const r = sphincterBase[k], y = sphincterBase[k + 1]
      const ring = sphincterBase[k + 7], urethra = sphincterBase[k + 8]
      const ripple = sphincterBase[k + 5] * c30 + sphincterBase[k + 6] * s30 // sin(4θ + 30t)
      const squeeze = 1.0 - clenchLevel * (0.1 + 0.12 * ring + 0.3 * urethra)
      const closed = (r + sphincterBase[k + 4] * foldDepth * ring + ripple * twitch) * squeeze
      const open = r * (1.0 + 0.25 * ring + 0.45 * urethra) // a narrow opening, not a nozzle
      const radius = THREE.MathUtils.lerp(closed, open, dil)
      const o = (count + j) * 3
      wall[o] = neck.x + sphincterBase[k + 2] * radius
      wall[o + 1] = neckTop + y - NECK_TOP_Y
      wall[o + 2] = neck.z + sphincterBase[k + 3] * radius
      // The urine stops at the neck.
      urinePos[o] = neck.x; urinePos[o + 1] = neck.y; urinePos[o + 2] = neck.z
    }
    bPos.needsUpdate = true
    computeNormals(bladderGeo)
    weldSeam(bladderGeo)

    // Urine: the wall's shape scaled about a point low in the sac, free to slosh within
    // whatever wall thickness there is around it. With none held (just voided), it isn't
    // drawn, so its normals can wait.
    const held = urineScale(sim.volume, sim.maxCapacity)
    const hasUrine = held > 0.002
    urineGeo.attributes.position.needsUpdate = true
    if (hasUrine || !urine) {
      computeNormals(urineGeo)
      weldSeam(urineGeo)
    }
    if (urine) {
      urine.visible = hasUrine
      const room = 1 - held / FLUID_INSET
      urine.scale.setScalar(Math.max(held, 1e-4))
      urine.position.set(sim.fluidCoreOffset.x * 0.4 * room, URINE_PIVOT_Y * inflationScale * scaleY * (1 - held), sim.fluidCoreOffset.z * 0.4 * room)
    }

    // Ureters stay plugged into the wall as it inflates and wobbles, and squeeze urine
    // down: faster while drinks are being filtered. Each squirt is heard from its side.
    let filtration = 0
    for (const b of sim.activeBeverages) filtration += b.rate
    ureters.forEach((ureter, k) => {
      wallPoint.fromBufferAttribute(bPos, ureter.endIndex)
      wallNormal.fromBufferAttribute(bladderGeo.attributes.normal, ureter.endIndex)
      ureter.route(wallPoint, wallNormal, growth)
      if (ureter.step(dt, filtration) > 0) {
        inflowAge[k] = 0
        squirt(k)
        objects.onSquirt?.(k === 0 ? -1 : 1)
      }
    })

    // Stream from the opening at the bottom of the urethra, wherever the body has moved it.
    outlet.set(neck.x, neckTop + OUTLET_Y - NECK_TOP_Y, neck.z).multiply(body.scale).add(body.offset)
    stream.update(sim, dt, timeSec, outlet, objects.stream, objects.drops)
  }

  return {
    bladderGeo, urineGeo, stream,
    ureterGeoLeft: ureters[0].geo, ureterGeoRight: ureters[1].geo,
    cutawayPlane, poke, slap, clearDents, emote: body.emote, update,
  }
}
