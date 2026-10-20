import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useUiStore } from '../../store/useUiStore'
import { act, onSimEvent, sim } from '../../sim/engine'
import { physicsOf } from '../../sim/sim'
import { orbitDrag, pokeAt, slapAt, squeezeCancel, squeezeDrag, squeezeRelease, squeezeStart } from '../../sim/interactions'
import { createOrganRig } from './organRig'

const ndc = new THREE.Vector2()

export default function Organ() {
  const rig = useMemo(() => createOrganRig(), [])
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

  // Dents follow the simulation's poke/slap events, whatever caused them.
  useEffect(() => {
    return onSimEvent((event) => {
      if (event.type === 'poke') rig.poke(event.local, event.strength)
      else if (event.type === 'slap') rig.slap(event.local, event.strength)
      else if (event.type === 'reset') rig.clearDents()
    })
  }, [rig])

  // Pointer handling mirrors the original: a press anywhere on the canvas starts a
  // gesture, and moves/releases are tracked on the window so drags survive leaving
  // the mesh. Presses that land on the bladder are handled by the mesh below.
  useEffect(() => {
    const canvas = get().gl.domElement
    let down = false
    let last = { x: 0, y: 0 }

    const hitBladder = (e) => {
      const { camera, raycaster } = get()
      const rect = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(bladderRef.current)[0]
      return hit ? bladderRef.current.worldToLocal(hit.point.clone()) : null
    }

    const onDown = (e) => {
      down = true
      last = { x: e.clientX, y: e.clientY }
    }
    const onMove = (e) => {
      if (!down) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      const speed = Math.hypot(dx, dy)
      last = { x: e.clientX, y: e.clientY }
      const mode = useUiStore.getState().interactionMode

      if (mode === 'orbit') act(orbitDrag, dx, dy)
      else if (mode === 'squeeze') act(squeezeDrag, dx, dy)
      else {
        const local = hitBladder(e)
        if (!local) return
        if (mode === 'slap' && speed > 10) act(slapAt, local, Math.min(3.0, speed * 0.14))
        else if (mode === 'poke') act(pokeAt, local, 0.7)
      }
    }
    const onUp = () => {
      down = false
      if (useUiStore.getState().interactionMode === 'squeeze') act(squeezeRelease)
    }
    const onCancel = () => {
      down = false
      act(squeezeCancel)
    }

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

  const handlePointerDown = (e) => {
    const local = bladderRef.current.worldToLocal(e.point.clone())
    const mode = useUiStore.getState().interactionMode
    if (mode === 'poke') act(pokeAt, local, physicsOf(sim).squishForce, { touch: true })
    else if (mode === 'slap') act(slapAt, local, 2.0, { haptic: true })
    else if (mode === 'squeeze') act(squeezeStart)
  }

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
      {/* Liquid: one solid body filling the sac. Drawn first so the membrane blends over it. */}
      <mesh geometry={rig.fluidGeo} renderOrder={1}>
        <meshPhysicalMaterial
          ref={fluidMatRef}
          color={0xfacc15}
          emissive={0xd97706}
          emissiveIntensity={0.22}
          roughness={0.12}
          metalness={0.0}
          transmission={0.55}
          ior={1.333}
          thickness={2.2}
          clippingPlanes={clip}
          side={THREE.FrontSide}
        />
      </mesh>
      {/* Cross-section of the liquid: the inside faces, shown only where the cutaway opens it. */}
      <mesh geometry={rig.fluidGeo} renderOrder={1} visible={isCutawayActive}>
        <meshBasicMaterial ref={fluidCapMatRef} color={0xd99a2b} clippingPlanes={clip} side={THREE.BackSide} />
      </mesh>

      {/* Wall: a thin translucent membrane that thins out as it stretches. */}
      <mesh ref={bladderRef} geometry={rig.bladderGeo} renderOrder={10} onPointerDown={handlePointerDown}>
        <meshPhysicalMaterial
          ref={wallMatRef}
          map={rig.diffTex}
          normalMap={rig.normTex}
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
        <meshPhysicalMaterial color={0xfacc15} emissive={0xd97706} emissiveIntensity={0.6} roughness={0.05} transmission={0.92} ior={1.333} transparent opacity={0.92} side={THREE.DoubleSide} />
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
