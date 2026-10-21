// Same result as BufferGeometry.computeVertexNormals() for indexed geometry, on the raw
// arrays. Three's version reads every corner through a Vector3, which made it the
// largest single cost of a frame on a throttled phone profile.
export function computeNormals(geometry) {
  const pos = geometry.attributes.position.array
  const nrm = geometry.attributes.normal.array
  const idx = geometry.index.array
  nrm.fill(0)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
    const cbx = pos[c] - pos[b], cby = pos[c + 1] - pos[b + 1], cbz = pos[c + 2] - pos[b + 2]
    const abx = pos[a] - pos[b], aby = pos[a + 1] - pos[b + 1], abz = pos[a + 2] - pos[b + 2]
    const nx = cby * abz - cbz * aby
    const ny = cbz * abx - cbx * abz
    const nz = cbx * aby - cby * abx
    nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz
    nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz
    nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const inv = 1 / (Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]) || 1)
    nrm[i] *= inv; nrm[i + 1] *= inv; nrm[i + 2] *= inv
  }
  geometry.attributes.normal.needsUpdate = true
}
