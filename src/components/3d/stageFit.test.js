import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ORGAN_HALF_HEIGHT, ORGAN_HALF_WIDTH, RAIL_ALLOWANCE_PX, stageFit } from './stageFit'

// Renders the fit with a real Three.js camera and projects points to screen pixels.
function project(fit, viewport, point) {
  const camera = new THREE.PerspectiveCamera(45, viewport.width / viewport.height, 0.1, 100)
  camera.setViewOffset(viewport.width, viewport.height, fit.offsetX, fit.offsetY, viewport.width, viewport.height)
  camera.position.set(0, 0, fit.distance)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const ndc = new THREE.Vector3(...point).project(camera)
  return { x: (ndc.x + 1) / 2 * viewport.width, y: (1 - ndc.y) / 2 * viewport.height }
}

const LAYOUTS = {
  'iPhone SE portrait': { viewport: { width: 320, height: 568 }, stage: { x: 8, y: 150, width: 304, height: 200 } },
  'Pixel 7 portrait': { viewport: { width: 412, height: 839 }, stage: { x: 8, y: 160, width: 396, height: 420 } },
  'phone landscape': { viewport: { width: 734, height: 343 }, stage: { x: 8, y: 120, width: 420, height: 215 } },
  'iPad portrait': { viewport: { width: 810, height: 1080 }, stage: { x: 16, y: 170, width: 778, height: 640 } },
}

describe('camera framing fits the organ inside the stage', () => {
  for (const [name, { viewport, stage }] of Object.entries(LAYOUTS)) {
    it(name, () => {
      const fit = stageFit({ fov: 45, viewport, stage, minDistance: 1 })
      const centre = project(fit, viewport, [0, 0, 0])
      expect(centre.x).toBeCloseTo(stage.x + stage.width / 2, 3)
      expect(centre.y).toBeCloseTo(stage.y + stage.height / 2, 3)

      const top = project(fit, viewport, [0, ORGAN_HALF_HEIGHT, 0])
      const bottom = project(fit, viewport, [0, -ORGAN_HALF_HEIGHT, 0])
      const left = project(fit, viewport, [-ORGAN_HALF_WIDTH, 0, 0])
      const right = project(fit, viewport, [ORGAN_HALF_WIDTH, 0, 0])
      expect(top.y).toBeGreaterThanOrEqual(stage.y - 0.5)
      expect(bottom.y).toBeLessThanOrEqual(stage.y + stage.height + 0.5)
      expect(left.x).toBeGreaterThanOrEqual(stage.x + RAIL_ALLOWANCE_PX - 0.5)
      expect(right.x).toBeLessThanOrEqual(stage.x + stage.width - RAIL_ALLOWANCE_PX + 0.5)
    })
  }

  it('respects the distance limits', () => {
    const fullScreen = { fov: 45, viewport: { width: 1000, height: 1000 }, stage: { x: 0, y: 0, width: 1000, height: 1000 } }
    expect(stageFit(fullScreen).distance).toBeCloseTo(4.1 / Math.tan(Math.PI / 8), 6) // ~9.9, height-bound
    expect(stageFit({ ...fullScreen, minDistance: 12 }).distance).toBe(12)
    expect(stageFit({ ...fullScreen, stage: { x: 0, y: 0, width: 1000, height: 10 } }).distance).toBe(40)
  })
})
