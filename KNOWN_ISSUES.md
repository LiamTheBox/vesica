# Known issues

Problems that are still open, including any that survived a fix attempt. Each entry records what
was tried, so nobody repeats a dead end. Fixed issues move to the bottom with the milestone that fixed them.

## Open

### Browser tests not run since the 2026-10-21 changes
- **Seen:** 2026-10-21. The browser suite was paused at the user's request. The specs were updated for the new rules
  (start helper picks the sandbox, 5 % strain from pokes/slaps, tone-gated leaks) and `e2e/arcade.spec.js` was added,
  but none of it has run. Expect to fix small things on the first run.
- **Next:** `npm run test:e2e` (5–7 min), or just `npx playwright test --project="Pixel 7"` for the logic specs.

### The empty bladder still looks crumpled; ureters attach high (from the 2026-10-21 analysis)
- **Seen:** 2026-10-21 screenshots. Below ~150 ml (including the start) the wall's outline is jagged, like crumpled
  cellophane: the rugae folds displace the outer surface, where a real bladder keeps a smooth outside and folds only its
  lining. The ureters attach above the equator (`createUreter` aims at y +0.3) where real ones enter low at the back,
  beside the neck. Not changed yet: neither was requested.

### Real-time waits are unreliable in browser tests
- **Seen:** M1. Headless WebGL runs at a few fps and each frame advances the sim by at most 0.08 s, so simulated
  time runs far slower than wall-clock time.
- **Workaround (in place):** timing-dependent tests pause the loop and step simulated time with `window.__vesica.step(n)`.
  Visual effects (springs, ripples) still run on frame time, so screenshot probes need generous waits.

### Pinch-zoom e2e test fails now and then
- **Seen:** 2026-10-20, once on Pixel 7 (`touch.spec.js`, "pinching with another tool zooms the camera and never
  pokes"): the camera distance didn't change at all (24.2492 before and after), so the pinch didn't register.
  It passed in the full run just before. The machine was under heavy outside load at the time.
- **Next:** check whether the camera starts at OrbitControls' max distance (StageFit sets it to 1.6 × the fitted
  distance) so a pinch in one direction can't move it, or whether the CDP touch events arrive too fast under load.

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
| Icon-only toolbar buttons had no accessible name; buttons under 44 px | M5 |
| Bladder hidden behind controls on a landscape phone | M6 |
| Small phones: tool rail overlapped the drinks shelf; 3D view squeezed; camera too close in portrait | M6 |
| Subtitle bubble sat on top of the telemetry bar | M6 |
| Port rendered ~2× slower than the original on a weak GPU. Cause: Three.js r185's transmission pass (an extra full render with mipmaps every frame; in the original's r128, `transmission` only lowered alpha), doubled while voiding by the stream's `DoubleSide` transmission. M1's "15 vs 2.5 fps" came from the dev server. | M7 |
| Ureter tubes allocated a new `TubeGeometry` (and ~200 vectors) almost every frame | M7 |
| Wake lock stayed on after a challenge was flushed; Retry could lose it (async race) | M7 |
| No audio suspend in the background (the original had one) | M7 |
