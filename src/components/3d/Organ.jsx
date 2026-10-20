import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useUiStore } from '../../store/useUiStore'
import { act, onSimEvent, sim } from '../../sim/engine'
import { pokeAt, slapAt, squeezeDrag, squeezeRelease, squeezeStart } from '../../sim/interactions'
import { createOrganRig } from './organRig'

export default function Organ() {
  const rig = useMemo(() => createOrganRig(), [])

  const bladderRef = useRef()
  const sphincterRef = useRef()
  const streamRef = useRef()
  const splashRef = useRef()
  const leftDropRef = useRef()
  const rightDropRef = useRef()
  const bladderMatRef = useRef()
  const fluidMatRef = useRef()

  const pointerDown = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const isCutawayActive = useUiStore((s) => s.isCutawayActive)

  useEffect(() => {
    return onSimEvent((event) => {
      if (event.type === 'reset') rig.clearDents()
      if (event.type === 'slapRequest') {
        const angle = Math.random() * Math.PI * 2
        const hit = new THREE.Vector3(Math.cos(angle) * 2.2, 0.2 + (Math.random() - 0.5) * 0.8, Math.sin(angle) * 2.2)
        const local = bladderRef.current.worldToLocal(hit)
        act(slapAt, local, 2.4)
        rig.dent(local, 1.8, 1.8)
      }
    })
  }, [rig])

  const handlePointerDown = (e) => {
    e.stopPropagation()
    pointerDown.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    const local = bladderRef.current.worldToLocal(e.point.clone())
    const mode = useUiStore.getState().interactionMode

    if (mode === 'poke') {
      act(pokeAt, local)
      rig.dent(local, 1.4, 0.7)
    } else if (mode === 'slap') {
      act(slapAt, local, 2.0)
      rig.dent(local, 1.8, 1.8)
    } else if (mode === 'squeeze') {
      act(squeezeStart)
    }
  }

  const handlePointerMove = (e) => {
    if (!pointerDown.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    if (useUiStore.getState().interactionMode === 'squeeze') act(squeezeDrag, dx, dy)
  }

  const handlePointerUp = () => {
    pointerDown.current = false
    if (useUiStore.getState().interactionMode === 'squeeze') act(squeezeRelease)
  }

  useFrame((state, delta) => {
    rig.update(sim, Math.min(0.08, delta), state.clock.getElapsedTime(), {
      bladderMat: bladderMatRef.current,
      fluidMat: fluidMatRef.current,
      sphincter: sphincterRef.current,
      stream: streamRef.current,
      splash: splashRef.current,
      leftDrop: leftDropRef.current,
      rightDrop: rightDropRef.current,
    })
  })

  const bladderClip = isCutawayActive ? [rig.cutawayPlane] : []
  const fluidClip = isCutawayActive ? [rig.fluidClipPlane, rig.cutawayPlane] : [rig.fluidClipPlane]

  return (
    <group position={[0, 0.2, 0]}>
      <mesh
        ref={bladderRef}
        geometry={rig.bladderGeo}
        renderOrder={10}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <meshPhysicalMaterial
          ref={bladderMatRef}
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
          transmission={0.65}
          thickness={1.4}
          ior={1.38}
          transparent
          opacity={0.88}
          depthWrite={false}
          side={isCutawayActive ? THREE.DoubleSide : THREE.FrontSide}
          clippingPlanes={bladderClip}
        />
      </mesh>

      <mesh geometry={rig.fluidGeo} renderOrder={1}>
        <meshPhysicalMaterial
          ref={fluidMatRef}
          color={0xfacc15}
          emissive={0xd97706}
          emissiveIntensity={0.55}
          roughness={0.08}
          metalness={0.1}
          transmission={0.88}
          ior={1.333}
          thickness={2.2}
          transparent
          opacity={0.94}
          clippingPlanes={fluidClip}
          clipShadows
          side={THREE.DoubleSide}
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

      <mesh geometry={rig.ureterGeo} renderOrder={3}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transmission={0.75} transparent opacity={0.85} />
      </mesh>
      <mesh geometry={rig.ureterGeo} renderOrder={3} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial color={0x94a3b8} roughness={0.3} transmission={0.75} transparent opacity={0.85} />
      </mesh>

      <mesh ref={leftDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} transmission={0.8} transparent opacity={0.95} />
      </mesh>
      <mesh ref={rightDropRef} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshPhysicalMaterial color={0xfef08a} emissive={0xf59e0b} emissiveIntensity={0.9} roughness={0.1} transmission={0.8} transparent opacity={0.95} />
      </mesh>
    </group>
  )
}
