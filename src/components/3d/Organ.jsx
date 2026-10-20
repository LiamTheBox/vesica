import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { selectQualityTier, useUiStore } from '../../store/useUiStore'
import { QUALITY_TIERS } from '../../settings/quality'
import { act, onSimEvent, sim } from '../../sim/engine'
import { physicsOf } from '../../sim/sim'
import { orbitDrag, pokeAt, slapAt, squeezeCancel, squeezeDrag, squeezePinch, squeezeRelease, squeezeStart } from '../../sim/interactions'
import { createOrganRig, createOrganTextures, FLUID_INSET } from './organRig'

const ndc = new THREE.Vector2()
// Liquid opacity without transmission. Transmission only replaces the diffuse light and
// keeps the glow and highlights, so a mostly opaque liquid matches it best (compared in M7).
const FLUID_OPACITY = 0.9

export default function Organ() {
  const rig = useMemo(() => createOrganRig(), [])
  const textures = useMemo(() => createOrganTextures(), [])
  const get = useThree((state) => state.get)

  const bladderRef = useRef()
  const sphincterRef = useRef()
  const streamRef = useRef()
  const splashRef = useRef()
  const leftDropRef = useRef()
  const rightDropRef = useRef()
  const wallMatRef = useRef()
  const fluidMatRef = useRef()
  const fluidCapMatRef = useRef()

  const isCutawayActive = useUiStore((s) => s.isCutawayActive)
  const refractive = QUALITY_TIERS[useUiStore(selectQualityTier)].transmission

  // Dents follow the simulation's poke/slap events, whatever caused them.
  useEffect(() => {
    return onSimEvent((event) => {
      if (event.type === 'poke') rig.poke(event.local, event.strength)
      else if (event.type === 'slap') rig.slap(event.local, event.strength)
      else if (event.type === 'reset') rig.clearDents()
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
        if (mode === 'slap' && speed > 10) act(slapAt, local, Math.min(3.0, speed * 0.14))
        else if (mode === 'poke') act(pokeAt, local, 0.7)
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

  useFrame((state, delta) => {
    rig.update(sim, Math.min(0.08, delta), state.clock.getElapsedTime(), {
      wallMat: wallMatRef.current,
      fluidMat: fluidMatRef.current,
      fluidCapMat: fluidCapMatRef.current,
      sphincter: sphincterRef.current,
      stream: streamRef.current,
      splash: splashRef.current,
      leftDrop: leftDropRef.current,
      rightDrop: rightDropRef.current,
      camera: state.camera,
      cutaway: isCutawayActive,
    })
  })

  const clip = isCutawayActive ? [rig.cutawayPlane] : []

  return (
    <group position={[0, 0.2, 0]}>
      {/* Liquid: one solid body filling the sac, the wall's own geometry just inside it.
          Drawn first so the membrane blends over it. High quality refracts what's behind
          it (transmission: a whole extra render pass); lower tiers let it through with
          plain transparency, which looks nearly the same. */}
      <mesh geometry={rig.bladderGeo} scale={FLUID_INSET} renderOrder={1}>
        <meshPhysicalMaterial
          key={refractive ? 'refractive' : 'blended'}
          ref={fluidMatRef}
          color={0xfacc15}
          emissive={0xd97706}
          emissiveIntensity={0.22}
          roughness={0.12}
          metalness={0.0}
          {...(refractive ? { transmission: 0.55, ior: 1.333, thickness: 2.2 } : { transparent: true, opacity: FLUID_OPACITY })}
          clippingPlanes={clip}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Cross-section of the liquid: the inside faces, shown only where the cutaway opens it. */}
      <mesh geometry={rig.bladderGeo} scale={FLUID_INSET} renderOrder={1} visible={isCutawayActive}>
        <meshBasicMaterial ref={fluidCapMatRef} color={0xd99a2b} clippingPlanes={clip} side={THREE.BackSide} />
      </mesh>

      {/* Wall: a thin translucent membrane that thins out as it stretches. */}
      <mesh ref={bladderRef} geometry={rig.bladderGeo} renderOrder={10}>
        <meshPhysicalMaterial
          ref={wallMatRef}
          map={textures.diffTex}
          normalMap={textures.normTex}
          normalScale={[0.8, 0.8]}
          color={0xf43f5e}
          emissive={0x881337}
          emissiveIntensity={0.28}
          roughness={0.22}
          metalness={0.05}
          clearcoat={0.9}
          clearcoatRoughness={0.12}
          transparent
          opacity={0.6}
          depthWrite={false}
          side={isCutawayActive ? THREE.DoubleSide : THREE.FrontSide}
          clippingPlanes={clip}
        />
      </mesh>

      <mesh ref={sphincterRef} geometry={rig.sphincterGeo} renderOrder={4} position={[0, -2.15, -0.2]}>
        <meshPhysicalMaterial color={0xe11d48} emissive={0x4c0519} emissiveIntensity={0.35} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.15} side={THREE.DoubleSide} />
      </mesh>

      <mesh ref={streamRef} geometry={rig.streamGeo} renderOrder={5} visible={false}>
        {/* No transmission: on a jet this thin it's invisible, and it doubled the frame cost while voiding. */}
        <meshPhysicalMaterial color={0xfacc15} emissive={0xd97706} emissiveIntensity={0.6} roughness={0.05} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>

      <points ref={splashRef} geometry={rig.splashGeo} renderOrder={6} visible={false}>
        <pointsMaterial color={0xfef08a} size={0.12} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>

      {/* Ureters are cut with the wall so a tube never dangles in front of the section. */}
      <mesh geometry={rig.ureterGeoLeft} renderOrder={3}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transparent opacity={0.85} clippingPlanes={clip} />
      </mesh>
      <mesh geometry={rig.ureterGeoRight} renderOrder={3}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transparent opacity={0.85} clippingPlanes={clip} />
      </mesh>

      <mesh ref={leftDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} />
      </mesh>
      <mesh ref={rightDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}
