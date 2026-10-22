# Known issues

Problems that are still open, including any that survived a fix attempt. Each entry records what
was tried, so nobody repeats a dead end. Fixed issues move to the bottom with the milestone that fixed them.

## Open

The two below are in the browser suite (`npm run test:e2e`), which isn't run for now (it loads the CPU).

### Real-time waits are unreliable in browser tests
- **Seen:** M1. Headless WebGL runs at a few fps and each frame advances the sim by at most 0.08 s, so simulated
  time runs far slower than wall-clock time.
- **Workaround (in place):** timing-dependent tests pause the loop and step simulated time with `window.__vesica.step(n)`.
  Visual effects (springs, ripples) still run on frame time, so screenshot probes need generous waits.

### Pinch-zoom e2e test fails now and then
- **Seen:** 2026-10-20, once on Pixel 7 (`touch.spec.js`, "pinching with another tool zooms the camera and never
  pokes"): the camera distance didn't change at all (24.2492 before and after), so the pinch didn't register.
  It passed in the full run just before. The machine was under heavy outside load at the time.
- **Ruled out (2026-10-21, from the code):** a zoom limit. StageFit starts the camera at the fitted distance with
  `minDistance` 0.25 × and `maxDistance` 1.6 × that, and the test spreads its fingers (zooms in), so it has room.
- **Next:** the CDP touch events arriving too fast or bunched under load. Try waiting a frame between moves, or
  polling the distance (`expect.poll`) instead of reading it once after the fingers lift.

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
| Empty bladder looked jagged, like crumpled cellophane: fine rugae folds pushed the outer surface sideways (the rugae now fold only the lining; the outside has soft deflated-balloon folds instead, as requested), and the lower half stepped out at the equator | 2026-10-21 |
| Ureters attached high on the sides; real ones enter low on the back, beside the neck | 2026-10-21 |
| A tap on the start screen also clicked the control under it (on an iPhone SE, Sandbox also drank an Energy): it started on the press and vanished before the click; it now starts on the click | 2026-10-21 |
| Other voice lines started while voiding (a drink, a poke, an urge fading, a line already under way or waiting its turn); now it says only the line that starts the void until it stops | 2026-10-21 |
| Fonts came from Google Fonts, cached only after an online visit, so a first install could show fallback fonts offline; they're bundled now | 2026-10-21 |
| The voice could pick Chrome's network voice ("Google US English"), which goes quiet offline; Automatic prefers voices on the device | 2026-10-21 |
| A microgames run hid the strain readout once its banner replaced the telemetry bar; the banner shows STRAIN now | 2026-10-21 |
| Sheets: whatever scrolled past showed through above the pinned header (it pinned inside the panel's padding) | 2026-10-21 |
| The faces, ☕ and ⚡ were black-and-white outlines on Linux: the generic sans-serif there (DejaVu Sans) has monochrome emoji and won over the colour fallback; a range-limited 'Color Emoji' face now comes first | 2026-10-22 |
| The arcade could hardly be lost: a slip saved cost nothing, and a clench that gave out came back in time to save the next, so waiting for SLIPPING! lasted ~4 min and holding Clench down ~7. A save now costs 35 % stamina and, like a clench giving out, leaves the grip shaky (stamina back at 40 % speed for 6 s), and Soothe takes 25 s to come back (was 20). Numbers in ROADMAP's reference | 2026-10-22 |
