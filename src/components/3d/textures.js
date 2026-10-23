import * as THREE from 'three'

// The wall's surface, painted once, like the realistic model's (requested): mottled red
// tissue with a fine network of pale creases and a few faint vessels, and a normal map that
// sinks the creases. It tiles, so it repeats around the organ, and the same seed paints the
// same tissue every time.
const SIZE = 512
// The wall's UVs run once around and once from the dome to the opening; these repeats keep
// the creases about as wide as they are tall on the bladder.
const WALL_REPEAT = [3, 1.5]
// A ureter's run along it and once around.
const URETER_REPEAT = [10, 1]

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const wrap = (i, period) => ((i % period) + period) % period
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Value noise on a lattice `period` cells a side, read in lattice units: it tiles every
// `period`.
function valueNoise(period, random) {
  const lattice = Float32Array.from({ length: period * period }, random)
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const fx = x - xi, fy = y - yi
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    const x0 = wrap(xi, period), y0 = wrap(yi, period)
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period
    const a = lattice[y0 * period + x0], b = lattice[y0 * period + x1]
    const c = lattice[y1 * period + x0], d = lattice[y1 * period + x1]
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
  }
}

// Cells `period` a side, a jittered point in each, read in cell units: how near (x, y) is to
// the edge between two cells (the second-nearest point's distance less the nearest's).
function cellEdges(period, random) {
  const px = Float32Array.from({ length: period * period }, () => 0.1 + 0.8 * random())
  const py = Float32Array.from({ length: period * period }, () => 0.1 + 0.8 * random())
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    let d1 = 9, d2 = 9
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const k = wrap(yi + j, period) * period + wrap(xi + i, period)
        const dx = xi + i + px[k] - x, dy = yi + j + py[k] - y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
      }
    }
    return d2 - d1
  }
}

// The tissue's colour (sRGB, RGBA bytes) and normal map (RGBA bytes), `size` pixels a side.
export function paintTissue(size = SIZE, seed = 11) {
  const random = seeded(seed)
  const broad = valueNoise(4, random)
  const mottle = valueNoise(24, random)
  const grain = valueNoise(128, random)
  const warpX = valueNoise(8, random)
  const warpY = valueNoise(8, random)
  const faint = valueNoise(12, random)
  const creases = cellEdges(24, random)
  const vessels = cellEdges(5, random)
  const color = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const tone = 0.6 * broad(u * 4, v * 4) + 0.4 * mottle(u * 24, v * 24)
      const shade = 0.86 + 0.28 * grain(u * 128, v * 128)
      // Creases: the cells' edges, wandering and some fainter than others.
      const wx = (warpX(u * 8, v * 8) - 0.5) * 0.9
      const wy = (warpY(u * 8, v * 8) - 0.5) * 0.9
      const crease = (1 - smooth(0, 0.07, creases(u * 24 + wx, v * 24 + wy))) * (0.3 + 0.7 * faint(u * 12, v * 12))
      const vessel = (1 - smooth(0, 0.03, vessels(u * 5 + wx * 0.6, v * 5 + wy * 0.6))) * 0.45
      let r = (104 + 66 * tone) * shade
      let g = (28 + 36 * tone) * shade
      let b = (32 + 30 * tone) * shade
      r += (224 - r) * crease * 0.42; g += (150 - g) * crease * 0.42; b += (138 - b) * crease * 0.42
      r += (66 - r) * vessel; g += (12 - g) * vessel; b += (24 - b) * vessel
      const o = (y * size + x) * 4
      color[o] = r; color[o + 1] = g; color[o + 2] = b; color[o + 3] = 255
      height[y * size + x] = -crease - 0.5 * vessel + 0.3 * (shade - 1)
    }
  }

  // Normals from the height's slope, wrapping around the edges so the map tiles too.
  const normal = new Uint8Array(size * size * 4)
  const STEEP = 2.2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height[y * size + wrap(x + 1, size)] - height[y * size + wrap(x - 1, size)]
      const dy = height[wrap(y + 1, size) * size + x] - height[wrap(y - 1, size) * size + x]
      const nx = -dx * STEEP, ny = -dy * STEEP
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const o = (y * size + x) * 4
      normal[o] = (nx * inv * 0.5 + 0.5) * 255
      normal[o + 1] = (ny * inv * 0.5 + 0.5) * 255
      normal[o + 2] = (inv * 0.5 + 0.5) * 255
      normal[o + 3] = 255
    }
  }
  return { color, normal, size }
}

function tiled(data, size, repeat) {
  const texture = new THREE.DataTexture(data, size, size)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(...repeat)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export function createOrganTextures() {
  const { color, normal, size } = paintTissue()
  const diffTex = tiled(color, size, WALL_REPEAT)
  diffTex.colorSpace = THREE.SRGBColorSpace
  const normTex = tiled(normal, size, WALL_REPEAT)
  const ureterDiff = tiled(color, size, URETER_REPEAT)
  ureterDiff.colorSpace = THREE.SRGBColorSpace
  const ureterNorm = tiled(normal, size, URETER_REPEAT)
  return { diffTex, normTex, ureterDiff, ureterNorm }
}
