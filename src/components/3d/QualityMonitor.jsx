import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { selectQualityTier, useUiStore } from '../../store/useUiStore'
import { createFpsMonitor, lowerTier, QUALITY_TIERS } from '../../settings/quality'

function applyTier(gl, tier) {
  gl.transmissionResolutionScale = QUALITY_TIERS[tier].transmissionScale
}

// Applies the renderer side of the quality tier, and in Auto steps down a tier when the
// device can't keep a smooth frame rate (see settings/quality.js). Scene sets the pixel
// ratio; Organ picks the liquid's material.
export function QualityMonitor() {
  const gl = useThree((s) => s.gl)
  const tier = useUiStore(selectQualityTier)
  const auto = useUiStore((s) => s.settings.graphics === 'auto')
  const monitor = useMemo(() => createFpsMonitor(), [])

  useEffect(() => {
    applyTier(gl, tier)
    monitor.reset()
  }, [gl, tier, monitor])

  useFrame((_, delta) => {
    if (!auto || tier === 'low') return
    // Sheets blur the whole screen over the canvas; don't judge the device by that.
    if (useUiStore.getState().currentTab !== 'sim') {
      monitor.reset()
      return
    }
    if (monitor.sample(delta)) useUiStore.getState().setAutoQuality(lowerTier(tier))
  })

  return null
}
