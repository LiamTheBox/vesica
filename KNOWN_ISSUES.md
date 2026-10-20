# Known issues

Problems that are still open, including any that survived a fix attempt. Each entry records what
was tried, so nobody repeats a dead end. Fixed issues move to the bottom with the milestone that fixed them.

## Open

### Port renders far slower than the original under software WebGL
- **Seen:** M1, in headless Chromium (software rendering): original ~15 fps, port ~2.5 fps.
- **Tried:** M2 removed the wall's `transmission` (one fewer transmission material) and the ureter tubes' transmission.
  Not yet re-measured.
- **Next:** measure on a real phone and in the M7 profiling pass; suspects are the deforming fluid mesh,
  `computeVertexNormals` on two 3k-vertex meshes per frame, and Three.js r185's transmission pass.
- **Planned:** M7 (move earlier if a real phone shows the same gap).

### Bladder hidden behind controls on a landscape phone
- **Seen:** M0 (`e2e/smoke.spec.js` keeps an expected-failure test for it).
- **Planned:** M6 (landscape layout with side rails).

### Icon-only toolbar buttons have no accessible name at phone width
- **Seen:** M2. Cutaway, Cough, Shake and the tool button hide their text below 640 px, leaving only an emoji,
  so screen readers (and tests) can't name them.
- **Planned:** M5 (tool picker and tap-target work).

### Real-time waits are unreliable in browser tests
- **Seen:** M1. Headless WebGL runs at a few fps and each frame advances the sim by at most 0.08 s, so simulated
  time runs far slower than wall-clock time.
- **Workaround (in place):** timing-dependent tests pause the loop and step simulated time with `window.__vesica.step(n)`.
  Visual effects (springs, ripples) still run on frame time, so screenshot probes need generous waits.

## Fixed

| Issue | Fixed in |
|---|---|
| `audio.playSquish` missing — every poke/squeeze threw | M0 |
| Whole app re-rendered every frame | M1 |
| Drink sound replayed when a drink finished | M1 |
| Cutaway only worked from the front (fixed world plane) | M2 |
| Liquid invisible behind the wall; hollow clipped shell inside | M2 |
| Ureters ran through the inside of the bladder | M2 |
| Jagged, torn wall at low fill (wrinkles finer than the mesh; per-vertex random tremor) | M2 |
