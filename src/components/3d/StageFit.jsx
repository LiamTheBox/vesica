import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useUiStore } from '../../store/useUiStore'
import { stageFit } from './stageFit'

// The original's fog was tuned for a camera 12 units away; keep its look at any distance.
const FOG_DENSITY_AT_12 = 0.038

function frameStage({ camera, controls, scene, size, stage }) {
  const fit = stageFit({ fov: camera.fov, viewport: size, stage })
  camera.setViewOffset(size.width, size.height, fit.offsetX, fit.offsetY, size.width, size.height)
  camera.position.setLength(fit.distance)
  camera.updateProjectionMatrix()
  if (controls) {
    controls.minDistance = fit.distance * 0.6
    controls.maxDistance = fit.distance * 1.6
    controls.update()
  }
  if (scene.fog) scene.fog.density = FOG_DENSITY_AT_12 * (12 / fit.distance)
}

// Frames the bladder in the HUD's stage whenever the layout changes (see stageFit.js).
// Keeps the current orbit angle; resets zoom to the fitted distance.
export function StageFit() {
  const stage = useUiStore((s) => s.stageRect)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)

  useEffect(() => {
    if (!stage || stage.width < 1 || stage.height < 1) return
    frameStage({ camera, controls, scene, size, stage })
  }, [stage, size, camera, controls, scene])

  return null
}
