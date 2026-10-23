import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { selectQualityTier, useUiStore } from '../../store/useUiStore'
import { QUALITY_TIERS } from '../../settings/quality'
import { act, onSimEvent, sim } from '../../sim/engine'
import { physicsOf } from '../../sim/sim'
import {
  orbitDrag, POKE_STRAIN, pokeAt, SLAP_STRAIN, slapAt, squeezeCancel, squeezeDrag, squeezePinch, squeezeRelease, squeezeStart,
} from '../../sim/interactions'
import { createOrganRig } from './organRig'
import { createOrganTextures } from './textures'
import { WALL_EMISSIVE } from './bodyLanguage'
import { emoteFor } from '../../feedback/emotes'
import { createCutMaterials } from './cutMaterials'
import { ureterSquirt } from '../../feedback/feedback'

// The system's reduce-motion setting (live): the body language's shakes get smaller.
const reducedMotion = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null

const ndc = new THREE.Vector2()
// Liquid opacity without transmission. Transmission only replaces the diffuse light and
// keeps the glow and highlights, so a mostly opaque liquid matches it best (compared in M7).
const FLUID_OPACITY = 0.9
// Light through the urine turns amber with distance, so the far wall seen through it
// reads as golden liquid rather than red muscle.
const REFRACTIVE_URINE = { transmission: 0.55, ior: 1.333, thickness: 2.2, attenuationColor: 0xf59e0b, attenuationDistance: 1.2 }
// Ureters: the wall's tissue, tinted and faded by vertex colours (amber where urine goes
// down them), with a dim red glow so the blue back light doesn't turn them grey.
// See-through like the wall (requested), as a membrane is: thin where you look straight
// through it, dense at the tube's edges, where you look along it. Both sides drawn, so the
// far side of the tube shows through the near one, and a tube the cutaway slices shows its
// inside rather than a hole.
const MEMBRANE_EDGES = /* glsl */ `
  diffuseColor.a = min(1.0, diffuseColor.a * mix(1.4, 0.55, abs(dot(nonPerturbedNormal, normalize(vViewPosition)))));
`
const URETER_MATERIAL = {
  vertexColors: true, color: 0xffffff, emissive: 0x3d0f14, emissiveIntensity: 0.45, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.4,
  side: THREE.DoubleSide, transparent: true,
  onBeforeCompile: (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `${MEMBRANE_EDGES}\n#include <opaque_fragment>`)
  },
  customProgramCacheKey: () => 'membrane',
}

// The urine reads as liquid, not jelly, and softly lit, not glossy (both requested): its
// surface is never still, so its soft highlights shimmer, and faint lines of light drift
// across it, as through moving water. Both move with the urine (they're in its own space),
// keep the cut face's time (so they quicken while it's sloshed about) and cost a few sines
// a pixel.
const LIQUID_PARS = /* glsl */ `
  uniform float uTime;
  varying vec3 vLiquid;
  float causticLines(vec3 p, float t) {
    vec3 q = p * 2.6;
    float a = sin(q.x * 2.1 + sin(q.y * 1.7 + t * 0.9) * 1.3 + t * 0.6);
    float b = sin(q.z * 2.3 + sin(q.x * 1.9 - t * 0.7) * 1.3 - t * 0.5);
    float c = sin(q.y * 2.0 + sin(q.z * 1.6 + t * 0.8) * 1.3 + t * 0.4);
    // Patchy: the light gathers here and there, and drifts.
    float gather = 0.5 + 0.5 * sin(p.x * 1.1 + t * 0.3) * sin(p.y * 0.9 - p.z * 0.7 - t * 0.25);
    return pow(1.0 - abs(a + b + c) / 3.0, 18.0) * gather * gather;
  }
`
const LIQUID_RIPPLE = /* glsl */ `
  {
    vec3 lp = vLiquid * 1.4;
    vec3 ripple = vec3(
      sin(lp.y * 3.1 + uTime * 1.3) * cos(lp.z * 2.3 - uTime * 0.9),
      sin(lp.z * 2.7 - uTime * 1.1) * cos(lp.x * 3.3 + uTime * 0.7),
      sin(lp.x * 2.9 + uTime * 1.2) * cos(lp.y * 2.1 - uTime * 1.0));
    normal = normalize(normal + (viewMatrix * vec4(ripple, 0.0)).xyz * 0.12);
  }
`
const LIQUID_GLINT = /* glsl */ `
  totalEmissiveRadiance += vec3(1.0, 0.92, 0.6) * causticLines(vLiquid, uTime) * 0.2;
`
function liquidShader(time) {
  return (shader) => {
    shader.uniforms.uTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLiquid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLiquid = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${LIQUID_PARS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${LIQUID_RIPPLE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${LIQUID_GLINT}`)
  }
}
const liquidCacheKey = () => 'liquid'

export default function Organ() {
  const rig = useMemo(() => createOrganRig(), [])
  const textures = useMemo(() => createOrganTextures(), [])
  const cut = useMemo(() => createCutMaterials(), [])
  const onLiquidCompile = useMemo(() => liquidShader(cut.urine.uniforms.uTime), [cut])
  const get = useThree((state) => state.get)

  const bodyRef = useRef()
  const bladderRef = useRef()
  const streamRef = useRef()
  const dropsRef = useRef()
  const wallMatRef = useRef()
  const urineRef = useRef()
  const fluidMatRef = useRef()

  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const refractive = QUALITY_TIERS[useUiStore(selectQualityTier)].transmission

  // Dents follow the simulation's poke/slap events, whatever caused them, and the bladder
  // reacts to what happens with its body too (a bounce, a sigh, a shudder...).
  useEffect(() => {
    return onSimEvent((event) => {
      if (event.type === 'poke') rig.poke(event.local, event.strength)
      else if (event.type === 'slap') rig.slap(event.local, event.strength)
      else if (event.type === 'reset') rig.clearDents()
      const kind = emoteFor(event, useUiStore.getState().mood)
      if (kind) rig.emote(kind)
    })
  }, [rig])

  // Pointer handling, per finger. A press on the canvas starts a gesture; moves and
  // releases are tracked on the window so a drag survives leaving the mesh (as in the
  // original). Fingers that started elsewhere (a thumb holding Clench) are ignored.
  // A second finger on the canvas turns the gesture into a pinch: Squeeze mode
  // squeezes; other tools leave zoom/rotate to OrbitControls.
  useEffect(() => {
    const canvas = get().gl.domElement
    const fingers = new Map() // pointerId -> { x, y }
    let primaryId = null // the finger driving the one-finger tool, if any
    let pinchDistance = 0
    let lastSwipeStrain = -Infinity

    const hitBladder = (e) => {
      const { camera, raycaster } = get()
      const rect = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(bladderRef.current)[0]
      return hit ? bladderRef.current.worldToLocal(hit.point.clone()) : null
    }
    const spread = () => {
      const [a, b] = [...fingers.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return // right/middle buttons move the camera
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const mode = useUiStore.getState().interactionMode

      if (fingers.size === 1) {
        primaryId = e.pointerId
        const local = hitBladder(e)
        if (!local) return
        if (mode === 'poke') act(pokeAt, local, physicsOf(sim).squishForce, { touch: true })
        else if (mode === 'slap') act(slapAt, local, 2.0, { haptic: true })
        else if (mode === 'squeeze') act(squeezeStart)
      } else if (fingers.size === 2) {
        primaryId = null // the one-finger tool stops once a second finger lands
        pinchDistance = spread()
      }
    }

    const onMove = (e) => {
      const finger = fingers.get(e.pointerId)
      if (!finger) return
      const dx = e.clientX - finger.x
      const dy = e.clientY - finger.y
      finger.x = e.clientX
      finger.y = e.clientY
      const mode = useUiStore.getState().interactionMode

      if (fingers.size >= 2) {
        if (mode === 'squeeze') {
          const distance = spread()
          act(squeezePinch, pinchDistance - distance)
          pinchDistance = distance
        }
        return
      }
      if (e.pointerId !== primaryId) return

      if (mode === 'orbit') act(orbitDrag, dx, dy)
      else if (mode === 'squeeze') act(squeezeDrag, dx, dy)
      else {
        const local = hitBladder(e)
        if (!local) return
        const speed = Math.hypot(dx, dy)
        if (mode === 'slap' && speed > 10) {
          // A swipe slaps on every move, but strains the sphincter like one slap per 150 ms.
          const now = performance.now()
          const strain = now - lastSwipeStrain >= 150 ? SLAP_STRAIN : 0
          if (strain) lastSwipeStrain = now
          act(slapAt, local, Math.min(3.0, speed * 0.14), { strain })
        } else if (mode === 'poke') {
          // A drag pokes on every move: strain by the distance rubbed, a poke's worth per 120 px.
          act(pokeAt, local, 0.7, { strain: POKE_STRAIN * Math.min(1, speed / 120) })
        }
      }
    }

    const release = (e, cancelled) => {
      if (!fingers.delete(e.pointerId)) return
      if (e.pointerId === primaryId) primaryId = null
      if (fingers.size > 0) return
      if (cancelled) act(squeezeCancel)
      else if (useUiStore.getState().interactionMode === 'squeeze') act(squeezeRelease)
    }
    const onUp = (e) => release(e, false)
    const onCancel = (e) => release(e, true)

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [get])

  useEffect(() => {
    cut.setClipping(isCutawayActive ? [rig.cutawayPlane] : [])
  }, [cut, rig, isCutawayActive])

  useFrame((state, delta) => {
    const dt = Math.min(0.08, delta)
    rig.update(sim, dt, state.clock.getElapsedTime(), {
      body: bodyRef.current,
      wallMat: wallMatRef.current,
      urine: urineRef.current,
      fluidMat: fluidMatRef.current,
      stream: streamRef.current,
      drops: dropsRef.current,
      camera: state.camera,
      cutaway: isCutawayActive,
      mood: useUiStore.getState().mood,
      reducedMotion: !!reducedMotion?.matches,
      onSquirt: ureterSquirt,
    })
    cut.update(sim, dt, rig.cutawayPlane, isCutawayActive)
  })

  const clip = isCutawayActive ? [rig.cutawayPlane] : []

  return (
    <group position={[0, 0.2, 0]}>
      {/* The organ itself; its body language (breathing, a bounce, a shudder...) moves this
          group about the neck (rig.update). */}
      <group ref={bodyRef} name="body">
        {/* Inside of the wall: muscle. Through the membrane it fills whatever the urine
            doesn't (a bladder holds no air); in the cutaway it's the cut face of the wall. */}
        <mesh name="wallTissue" geometry={rig.bladderGeo} material={cut.tissue} renderOrder={2} />

        {/* Urine: the wall's smooth shape, scaled to the volume held (rig.update sets the
            transform), so an empty bladder holds none. Drawn first so the membrane blends
            over it. High quality refracts what's behind it (transmission: a whole extra
            render pass); lower tiers let it through with plain transparency, which looks
            nearly the same. */}
        <group ref={urineRef} name="urine">
          <mesh geometry={rig.urineGeo} renderOrder={1}>
            <meshPhysicalMaterial
              key={refractive ? 'refractive' : 'blended'}
              ref={fluidMatRef}
              color={0xfacc15}
              emissive={0xd97706}
              emissiveIntensity={0.22}
              roughness={0.3}
              metalness={0.0}
              clearcoat={0.15}
              clearcoatRoughness={0.5}
              {...(refractive ? REFRACTIVE_URINE : { transparent: true, opacity: FLUID_OPACITY })}
              clippingPlanes={clip}
              side={THREE.FrontSide}
              onBeforeCompile={onLiquidCompile}
              customProgramCacheKey={liquidCacheKey}
            />
          </mesh>
          {/* Cross-section of the urine, shown only where the cutaway opens it. */}
          <mesh name="urineCut" geometry={rig.urineGeo} material={cut.urine} renderOrder={1} visible={isCutawayActive} />
        </group>

        {/* Wall: one surface from the dome down through the sphincter ring and the urethra
            to the opening, in the realistic model's creased red tissue. The bladder is a
            translucent membrane that thins out as it stretches; the sphincter is solid
            muscle. Opacity and the sphincter's colours come per vertex. */}
        <mesh ref={bladderRef} name="wall" geometry={rig.bladderGeo} renderOrder={10}>
          <meshPhysicalMaterial
            ref={wallMatRef}
            map={textures.diffTex}
            normalMap={textures.normTex}
            normalScale={[0.6, 0.6]}
            vertexColors
            color={0xffffff}
            emissive={WALL_EMISSIVE}
            emissiveIntensity={0.15}
            roughness={0.5}
            metalness={0}
            clearcoat={0.15}
            clearcoatRoughness={0.4}
            transparent
            depthWrite={false}
            side={THREE.FrontSide}
            clippingPlanes={clip}
          />
        </mesh>

        {/* Ureters (ureter.js): tubes of the same tissue, amber where urine is squeezed down
            them, flaring into the wall. Drawn after the wall, so one in front of it blends
            over it; one behind the bladder is hidden by the tissue. Cut with the wall so a
            tube never dangles in front of the section. */}
        <mesh geometry={rig.ureterGeoLeft} renderOrder={11}>
          <meshPhysicalMaterial {...URETER_MATERIAL} map={textures.ureterDiff} normalMap={textures.ureterNorm} clippingPlanes={clip} />
        </mesh>
        <mesh geometry={rig.ureterGeoRight} renderOrder={11}>
          <meshPhysicalMaterial {...URETER_MATERIAL} map={textures.ureterDiff} normalMap={textures.ureterNorm} clippingPlanes={clip} />
        </mesh>
      </group>

      {/* Stream: the jet and the drops it breaks into (stream.js), outside the body so it
          falls straight; it leaves from wherever the body has moved the opening. No
          transmission: on a jet this thin it's invisible, and it doubled the frame cost
          while voiding. */}
      <mesh ref={streamRef} geometry={rig.stream.jetGeo} material={rig.stream.material} renderOrder={5} visible={false} frustumCulled={false} />
      <instancedMesh
        ref={dropsRef}
        args={[rig.stream.dropGeo, rig.stream.material, rig.stream.maxDrops]}
        renderOrder={5}
        visible={false}
        frustumCulled={false}
      />
    </group>
  )
}
