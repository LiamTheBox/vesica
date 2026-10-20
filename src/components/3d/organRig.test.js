import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { ORGAN_CENTER, orientCutaway } from './organRig'

// Three.js clips points whose signed distance to a clipping plane is negative.
const isClipped = (plane, point) => plane.distanceToPoint(point) < 0

describe('cutaway faces the player', () => {
  const plane = new THREE.Plane()
  const cases = {
    front: new THREE.Vector3(0, 1.7, 12),
    back: new THREE.Vector3(0, 1.7, -12),
    side: new THREE.Vector3(12, 0.2, 0),
    'above at an angle': new THREE.Vector3(-6, 9, 6),
  }

  for (const [name, camera] of Object.entries(cases)) {
    it(`removes the near half and keeps the far half (${name})`, () => {
      orientCutaway(plane, camera)
      const towardCamera = camera.clone().sub(ORGAN_CENTER).normalize()
      const nearWall = ORGAN_CENTER.clone().addScaledVector(towardCamera, 2)
      const farWall = ORGAN_CENTER.clone().addScaledVector(towardCamera, -2)
      expect(isClipped(plane, nearWall)).toBe(true)
      expect(isClipped(plane, farWall)).toBe(false)
      expect(plane.distanceToPoint(ORGAN_CENTER)).toBeCloseTo(0, 9)
    })
  }
})
