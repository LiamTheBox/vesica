import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useUiStore } from '../../store/useUiStore'
import { sim } from '../../sim/engine'
import { overfillGrowth } from './organGeometry'
import { stageFit } from './stageFit'

// The original's fog was tuned for a camera 12 units away; keep its look at any distance.
const FOG_DENSITY_AT_12 = 0.038
// Panning keeps the view's centre near the organ: from above the bladder down past the
// sphincter to the stream.
const PAN_MIN = new THREE.Vector3(-3, -8, -3)
const PAN_MAX = new THREE.Vector3(3, 3, 3)
// Zoom: close enough to look into the sphincter, out to a little past the fitted view.
const ZOOM_IN = 0.25
const ZOOM_OUT = 1.6

const ORIGIN = new THREE.Vector3()
const direction = new THREE.Vector3()
const clamped = new THREE.Vector3()
const panMin = new THREE.Vector3()
const panMax = new THREE.Vector3()

// Scales the view's distance by `k` about the target: the camera, its zoom range and the fog
// together, so the player's zoom and angle stay as they were.
function backOff({ camera, controls, scene }, k) {
  camera.position.sub(controls.target).multiplyScalar(k).add(controls.target)
  controls.minDistance *= k
  controls.maxDistance *= k
  if (scene.fog) scene.fog.density /= k
}

// `growth`: how far an overfilled bladder has outgrown the frame (see overfillGrowth); the
// fitted distance backs off by as much.
function frameStage({ camera, controls, scene, size, stage, growth }) {
  const fit = stageFit({ fov: camera.fov, viewport: size, stage })
  fit.distance *= growth
  if (controls) {
    // Use up any pan or turn still easing out (damping), or it would drift the view again.
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = true
  }
  camera.setViewOffset(size.width, size.height, fit.offsetX, fit.offsetY, size.width, size.height)
  // Keep the orbit angle, look at the organ again, and go back to the fitted distance.
  direction.subVectors(camera.position, controls ? controls.target : ORIGIN).normalize()
  if (controls) controls.target.set(0, 0, 0)
  camera.position.copy(direction).multiplyScalar(fit.distance)
  camera.updateProjectionMatrix()
  if (controls) {
    controls.minDistance = fit.distance * ZOOM_IN
    controls.maxDistance = fit.distance * ZOOM_OUT
    controls.update()
  }
  if (scene.fog) scene.fog.density = FOG_DENSITY_AT_12 * (12 / fit.distance)
  return fit.distance
}

// Frames the bladder in the HUD's stage whenever the layout changes or the player asks to
// recenter (see stageFit.js): keeps the orbit angle, resets pan and zoom. While the player
// pans or zooms, it keeps the view near the organ and tells the HUD the view has moved.
// When an overfilled bladder (the arcade's has no limit) outgrows the frame, the camera
// backs off as it grows, keeping the player's zoom and angle.
export function StageFit() {
  const stage = useUiStore((s) => s.stageRect)
  const resetId = useUiStore((s) => s.viewResetId)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const fitDistance = useRef(0)
  const growth = useRef(1) // how far the view has backed off for an overfilled bladder

  useEffect(() => {
    if (!stage || stage.width < 1 || stage.height < 1) return
    fitDistance.current = frameStage({ camera, controls, scene, size, stage, growth: growth.current })
    useUiStore.setState({ viewMoved: false })
  }, [stage, size, camera, controls, scene, resetId])

  // Backs off (or comes back in) as the bladder grows (or empties), easing over a second
  // or so.
  useFrame((_, delta) => {
    if (!controls || fitDistance.current === 0) return
    const target = overfillGrowth(sim.volume / sim.maxCapacity)
    const next = growth.current + (target - growth.current) * Math.min(1, Math.min(0.08, delta) * 3)
    const k = next / growth.current
    if (Math.abs(k - 1) < 1e-5) return
    growth.current = next
    fitDistance.current *= k
    backOff({ camera, controls, scene }, k)
  })

  useEffect(() => {
    if (!controls) return
    const onChange = () => {
      panMin.copy(PAN_MIN).multiplyScalar(growth.current)
      panMax.copy(PAN_MAX).multiplyScalar(growth.current)
      clamped.copy(controls.target).clamp(panMin, panMax).sub(controls.target)
      if (clamped.lengthSq() > 0) {
        controls.target.add(clamped)
        camera.position.add(clamped)
      }
      const distance = camera.position.distanceTo(controls.target)
      const moved = controls.target.lengthSq() > 0.09 || Math.abs(distance / fitDistance.current - 1) > 0.15
      if (moved !== useUiStore.getState().viewMoved) useUiStore.setState({ viewMoved: moved })
    }
    controls.addEventListener('change', onChange)
    return () => controls.removeEventListener('change', onChange)
  }, [controls, camera])

  return null
}
