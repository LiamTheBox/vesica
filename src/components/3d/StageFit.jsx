import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useUiStore } from '../../store/useUiStore'
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

function frameStage({ camera, controls, scene, size, stage }) {
  const fit = stageFit({ fov: camera.fov, viewport: size, stage })
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
export function StageFit() {
  const stage = useUiStore((s) => s.stageRect)
  const resetId = useUiStore((s) => s.viewResetId)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const fitDistance = useRef(0)

  useEffect(() => {
    if (!stage || stage.width < 1 || stage.height < 1) return
    fitDistance.current = frameStage({ camera, controls, scene, size, stage })
    useUiStore.setState({ viewMoved: false })
  }, [stage, size, camera, controls, scene, resetId])

  useEffect(() => {
    if (!controls) return
    const onChange = () => {
      clamped.copy(controls.target).clamp(PAN_MIN, PAN_MAX).sub(controls.target)
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
