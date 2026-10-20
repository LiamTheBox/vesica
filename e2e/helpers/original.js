import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Opens the original single-file game so its live state can be compared with the port.
// The original pulls Three.js and Tailwind from CDNs, so it needs network access.

export const ORIGINAL_URL = pathToFileURL(path.resolve('Vesica 3D Mobile Web App.html')).href

// Returns false when the CDN scripts could not load (e.g. offline).
export async function openOriginal(page) {
  await page.goto(ORIGINAL_URL)
  try {
    await page.waitForFunction('typeof THREE !== "undefined" && typeof bladderMesh !== "undefined" && !!bladderMesh', null, { timeout: 15000 })
    return true
  } catch {
    return false
  }
}

// The original keeps its state in a top-level `const sim`, reachable from page scripts.
export function readOriginalSim(page) {
  return page.evaluate(`({
    volume: sim.volume,
    pressure: sim.pressure,
    kegelStamina: sim.kegelStamina,
    sphincterToneStrain: sim.sphincterToneStrain,
    detrusorSpasmIntensity: sim.detrusorSpasmIntensity,
    flowRate: sim.flowRate,
    totalLeakedVolume: sim.totalLeakedVolume,
    isStressLeaking: sim.isStressLeaking,
    involuntaryVoiding: sim.involuntaryVoiding,
  })`)
}
