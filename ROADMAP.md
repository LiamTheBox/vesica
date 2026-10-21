# Vesica 3D — Port Parity & Mobile Roadmap

Goal: make the React/Vite port play like the original single-file game
(`Vesica 3D Mobile Web App.html`), then make it a solid touch-first mobile app (installable PWA).

Every milestone ends with a **gate**. A milestone is done only when its gate passes:

1. `npm run check` is green (lint + unit tests + production build).
2. That milestone's automated checks pass (unit and/or Playwright mobile-emulation tests).
3. The manual checklist has been run on a real phone (some things, like haptics, speech, device
   motion and install, can't be emulated).
4. Work is committed and tagged `m<N>`, so any milestone can be diffed or rolled back.

Status legend: ☐ todo · ◐ in progress · ☑ done

## Where things stand (2026-10-21)

- **M0–M7:** code done, automated gates passed, tagged `m0`–`m7`. Every milestone's **phone check is still open**.
- **After M7 (requested, 2026-10-20):** urine scales with the volume held over a thick muscle wall, with shaded cut
  faces; the sphincter is a muscle ring above a urethra; Kegel recovers 4× faster and eases sphincter strain while held.
- **Requested 2026-10-21:** new physiology (slow kidney fill, steeper pressure, tone-gated leaks, freeze and squeeze,
  20 ml/s flow), **arcade mode as the default**, camera panning and closer zoom, and a new urine stream. See the
  section below.
- **Live:** https://liamthebox.github.io/vesica/ (deployed by GitHub Actions on every push to `main`). Check that
  Settings → Pages → Source is "GitHub Actions", or the old branch publish can overwrite the app.
- **Tests:** `npm run check` green (124 unit tests). Browser tests are still paused at the user's request: the specs
  were updated for the 2026-10-21 rules and `e2e/arcade.spec.js` was added, but **none of it has been run yet**
  (last full run, before these changes: 85 passed). One flaky pinch-zoom test is open (KNOWN_ISSUES).
- **Next:** run the browser suite, phone checks (on the live site), then M8 (minigames).

---

## Requested 2026-10-21 — physiology, arcade mode, camera, stream ☑ (unit tests green; browser tests not run)

**Physiology** (`src/sim/sim.js`, sandbox and arcade alike):
- ☑ Kidneys fill at **1 ml / 30 s** (was 1 ml/s). Drinks still arrive in seconds, so they now do most of the filling.
- ☑ **Pressure rises more**, low while the wall stretches and steep near capacity: 4 + 80·fill³ cmH₂O (was
  4 + 56·fill^2.6): 14 at half full, 45 at 80 %, 84 at 750 ml, 160 overfull.
- ☑ **Clench drains 2× slower** (0.11/s): a full hold lasts ~9 s.
- ☑ **Sphincter tone is the leak gauge.** Urge waves, coughs and squeezes raise it, harder the fuller the bladder
  (an unclenched wave adds ~29 % at 80 % full, a cough ~14 %); a held clench braces against 75 % of it. **Leaks only
  start at 100 %**: a 12 ml/s spurt that a clench shuts, or total failure above 65 cmH₂O (as in the original). After
  a spurt runs out the sphincter regains some grip (85 %). Holding a clench at 100 % against more strain burns stamina.
- ☑ **Freeze and squeeze** (the missing piece from the realism review): clenching during an urge wave calms the bladder
  muscle by reflex. The spasm drains while the clench is held and the wave ends early; a clench already held as a wave
  lands stops it at once.
- ☑ **Pokes and slaps add 5 %** each (were 8 % and 15 %). A drag pokes on every move, so it adds strain by the
  distance rubbed, and a swipe counts as one slap at most every 150 ms.
- ☑ **Voiding peaks at 20 ml/s** and slows over the last ~150 ml (the real flow curve rises fast, then tapers as the
  emptying bladder's contraction weakens): 300 ml takes ~22 s, 700 ml ~42 s. Voiding eases the strain; total failure
  empties at the same flow and now counts as leaked (the commute challenge used to miss it).
- ☑ Capacity stays 750 ml, but it's now reachable: pressure alone no longer forces leaks at ~670 ml.

**Arcade mode, the default** (`src/sim/arcade.js`): an endless hold on the same simulation.
- ☑ The start screen begins a run on any tap; a Sandbox button gives free play. The Challenges sheet has Arcade
  (start/restart, best score) and Sandbox (free play, ends a run) cards above the two challenges.
- ☑ Drinks are served every 26 → 12 s (bigger ones later); choosing to drink scores 0.5 pt/ml.
- ☑ Every urge is announced 1.2 s ahead (0.6 s later on) with a banner, a cue and a ring on Clench. Clench during the
  warning or within 0.35 s of the wave: **perfect** (the wave is calmed at once, 50 × combo, 15 % stamina back);
  later: 20 pts; no clench: combo lost. From level 2, sneezes are announced 1 s ahead: brace for 40 × combo.
- ☑ At 100 % strain there's 0.6 s to clench ("SLIPPING!"), +30 for the save; a leak costs 100 and the combo.
- ☑ Clenching with nothing to hold back costs 3× stamina and eases no strain; after giving out, the clench needs 30 %
  back. Soothe has a 20 s cooldown.
- ☑ Every 30 s a level: stronger, closer, later-announced urges that take longer to calm; the pelvic floor tires
  (less relief, weaker brace).
- ☑ Scoring: 10 pts/s × fill (×1 under 50 %, ×2, ×3 from 75 %, ×5 overfull). **Emptying banks** the run with a
  bonus of volume × fill multiplier; total failure ends it unbanked. Best score saved on the device.
- Balance, from headless bots: never clenching fails in ~1 min; always clenching late (0.35 s after a wave lands)
  in ~3.5 min; a player who usually uses the warnings but sometimes reacts late or misses one in 3–4 min; holding
  Clench down permanently in ~4.5 min; a perfect clench on every warning survives (combo bonus capped at ×10).
- Note: the **commute challenge is much easier** under the new rules (reacting to waves is enough to win).

**Camera** (`Scene.jsx`, `StageFit.jsx`): ☑ right-drag pans in any tool; with the Orbit tool a two-finger drag pans
(pinch still zooms); the wheel zooms toward the pointer; zoom goes 2.5× closer than before (to the sphincter);
panning stays near the organ; a Recenter button appears once the view has moved.

**Stream** (`stream.js`, replaces the tube and splash): ☑ a jet from a single narrow opening (the urethra no longer
widens into a nozzle) that thins as it falls, twists like a ribbon near the outlet, swells and pinches, and breaks
into drops. Its flow, aim and twist wander, and each wobble travels down with the fluid. Leaks come out in spurts,
the end of a void dribbles, and the colour follows hydration (pale straw to amber).

**Automated (unit):** sim rules (31 → 47 tests incl. pressure curve, tone-gated leaks, overload, freeze and squeeze,
flow taper), 15 arcade tests, 6 stream tests, arcade bests, readout states; 124 in all.
**Automated (e2e, written, not run):** start helper picks the sandbox unless asked for the arcade; strain expectations
5 %; the cough-leak scenario rewritten for tone-gated leaks; `e2e/arcade.spec.js` (start, perfect clench, banking).
**Manual:** ☐ play a few arcade runs on the phone; pan to the sphincter with two fingers; watch a void and a leak.

---

## M0 — Baseline & verification harness ◐ (automated gate passed; phone check pending)

Set up the tools every later milestone relies on. No gameplay changes.

- ☑ `git init`, commit the current state as `baseline` (tag `baseline`).
- ☑ `.node-version` (Node 22; it's installed through fnm but not on PATH).
- ☑ **Vitest** 5.0.5 for unit tests and **Playwright** 1.63.0 for browser tests (that version matches the cached Chromium 1243).
- ☑ Playwright projects for phone emulation with touch: iPhone SE, iPhone 15 Pro, iPhone 15 Pro landscape, Pixel 7, iPad (gen 7).
  All run on Chromium; WebGL is software-rendered, so tests use 2 workers and a 60 s timeout.
- ☑ Dev-only debug hook `window.__vesica` (`getState`, `setState`, `renders`, `resetRenders`); verified absent
  from production builds. *Stepping N frames moves to M1, since it needs the pure step function.*
- ☑ Scripts: `test`, `test:e2e`, `check` (lint + test + build), `dev:phone` (HTTPS dev server on the LAN).
- ☑ Smoke test on every device: loads with no console errors, canvas fills the viewport, the start tap dismisses the overlay,
  the simulation runs, a poke on the 3D view doesn't throw; screenshots saved.
- ☑ Parity reference: `src/test/original.js` pulls constants from the original HTML (beverages and physics presets match);
  `e2e/helpers/original.js` opens the original and reads its live `sim` (resting state matches the port).

**Found and fixed in M0:** `audio.playSquish` was missing from the port, so every poke or squeeze threw before
its voice line and vibration.
**Found for M6:** on a landscape phone the HUD covers the whole bladder (an expected-failure test tracks it).
**Found for M2:** the bladder looks jagged and torn just after a poke; compare with the original when poke strength is reworked.
**Local setup note:** VS Code runs as a Flatpak and sets `XDG_CACHE_HOME`, so Playwright looked for browsers in
`~/.var/app/com.visualstudio.code/cache`; that folder now symlinks to `~/.cache/ms-playwright`.

**Gate:** ☑ `npm run check` (lint 0 errors / 29 pre-existing warnings, 2 unit tests, build) · ☑ e2e 11 passed,
4 skipped, stable across 2 runs.
**Manual:** ☐ run `npm run dev:phone`, open the printed `https://<LAN-IP>:5173` URL on your phone (accept the
self-signed certificate warning), check that the app loads and the start tap works.

---

## M1 — Simulation core ported from the original + event bus ◐ (automated gate passed; play check pending)

The physics used to live inside an R3F `useFrame`, sounds were triggered by React effects reacting to
state changes (so a drink sound replayed when a drink finished), and the whole app re-rendered at 60 fps.

**Scope change:** porting `updatePhysics()` faithfully brings back everything inside it, so urge waves,
creaks, clench exhaustion and challenge scoring landed here instead of M2–M4. Hiding them behind flags for
one milestone would have been wasted work. The game is therefore **harder than before M1**: that's the
original's difficulty returning, not a regression.

- ☑ `src/sim/sim.js`: line-by-line port of the original `updatePhysics()` (simulation half) and its action
  handlers (drink, clench, void, soothe, cough, shake, reset, both challenges). Mutates one `sim` object like
  the original, returns side effects as events, takes `rng` for deterministic tests.
- ☑ `src/sim/engine.js`: the live `sim`, event bus, `act(action, …)`, pause/step for tests, and a rounded HUD
  snapshot published to the UI store only when a displayed value changes.
- ☑ `src/feedback/feedback.js`: maps events to the original's sounds, voice lines and haptics. Replaces
  `useAudioAndHaptics.js` (the drink-sound replay bug is gone).
- ☑ `src/components/3d/organRig.js`: geometry and per-frame deformation moved out of React render.
- ☑ Debug hook gains `act`, `pause`, `resume`, `step(n)`, an event log and `getUi`.
- ☑ Lint warnings: 29 → 0.
- ☑ Restored from the original (pulled forward from M2–M4): urge waves (timer 18 s → 7 s, +24 cmH₂O, rumble,
  banner); tension creaks; "CLENCH EXHAUSTED!" + clench hum pitch; cough/soothe/shake/reset with full feedback
  and original strengths; potholes = cough + agitation; voice back to a 10 s gap with no interrupting;
  "deflated" after voids under 150 ml and after failures; Reset says "deflated"; challenges reset the organ
  first and are scored (commute ≤ 20 ml, precision 200 ± 10 ml), with live status on the challenge cards;
  "VOIDING…" label; the three alert banners show independently, as in the original.

- ☑ **Changed later (requested):** Kegel stamina recovers at 0.64/s, 4× the original's 0.16/s (a full
  refill takes ~1.5 s instead of ~6 s). The parity test lists it as a deliberate difference.
- ☑ **Added later (requested):** holding the Kegel eases the sphincter strain by 10 % per second held (the original
  only eased it with Soothe); a full hold (~4.5 s) takes off ~45 %. The readout shows it falling: CLENCHED (n%).

**Automated (unit), 34 tests in `src/sim/sim.test.js`:** initial state equals the original's `sim` field by field
(read from the HTML); pressure curve at fill 0.2/0.5/0.8/1.0 and with a cough; stamina 0.22/s drain and 0.16/s
recovery; exhaustion and the 15 % label reset; 5 % clench floor; void starts between 0.95 s and 1.05 s, can't
start while clenching, stops at 10 ml; leaks only above 50 % fill, blocked by a clench, 22 ml/s; total failure
drains to 70 ml and recovers; urge waves within 18 s, sooner when fuller, never at ≤ 45 %; creak cooldown;
water adds 180 ml at 8 ml/s; reset; commute won/lost; precision success/failure; voice thresholds.
**Automated (e2e), `e2e/sim.spec.js`:** `App` and `HUD` render **0** times in 3 s of idle play (was ~180);
the same cough and urge scenarios run in the original and the port both leak or show the banner; the Water,
Clench, Empty and Commute controls drive the sim through the real UI.
Timing-dependent browser tests pause the loop and step simulated time: headless WebGL is software-rendered at a few fps.
**Gate:** ☑ `npm run check` (lint 0 warnings, 36 unit tests, build) · ☑ e2e 18 passed, 4 skipped (landscape expected failure as before).
**Manual:** ☐ play for a few minutes on the phone: urge banner + rumble from ~45 % full, leaks under coughs,
voice no more than every 10 s, challenges report results.

---

## M2 — Bladder interactions + water-balloon visuals ◐ (automated gate passed; play check pending)

- ☑ **Poke/slap match the original exactly** (`src/sim/interactions.js`): +0.08 / +0.15 strain, poke at
  `squishForce` 2.2, slap power ×2.2, dent caps 0.6 / 0.8, original slosh and jiggle, no ripple on pokes,
  slap ripples use `waveSpeed`/`rippleDecay`. E2E runs the same touch in both games: strain, slosh and jiggle are identical.
- ☑ Drag-to-poke (0.7 per move) and swipe-to-slap (speed > 10 px, strength up to 3.0).
- ☑ Slap button = original `triggerSlapImpulse` (random equator point, 2.4, no touch vibration).
- ☑ Window-level pointer tracking like the original: squeezes and drags survive leaving the mesh; orbit sloshes.
- ☑ **See-through (requested):** the cutaway used a fixed world plane, so from behind it did nothing (in the
  original too). It now always removes the half facing the camera, and clips the ureters with it.
- ☑ **Water balloon (requested):** the sac is always full of liquid (a real bladder has no air; size shows
  volume) instead of a hollow shell sliced by a fill-level plane. The wall is a translucent membrane that thins
  as it stretches; the liquid is one solid body inside; the cutaway shows a flat liquid cross-section.
  Dents conserve volume (the rest of the wall bulges out); ureters stay attached to the moving wall;
  rugae folds are broader and the strain tremor is smooth, fixing the torn, spiky look at low fill.
- ☑ Raycasting uses a bounding sphere that fits the fully inflated bladder (edge taps used to miss).
- ☑ **Revised after M7 (requested): no urine when empty.** The urine is the wall's shape scaled to the volume
  actually held (`urineScale`): none at the 10 ml left after voiding, just inside the membrane when full. Still
  no air: whatever the urine doesn't fill is muscle wall, thick and folded when empty, drawn as opaque tissue
  behind the membrane. In the cutaway, new cut-face shaders (`cutMaterials.js`) replace the flat colour: urine
  in amber that deepens with depth, lit from above, with drifting caustic light, rising bubbles and a pale lining
  at its edge; the wall as fibrous red muscle with a darker outer layer.
- ☑ **Sphincter redesigned (requested):** the straight red tube is now a thick muscular ring at the bladder
  neck, puckered with drawstring folds, above a narrower pink urethra (a lathe-turned profile with vertex
  colours). A clench eases in, clamps the ring and deepens the folds; voiding opens the ring and widens the
  urethra for the stream; strain keeps the original's rippling twitch.

**Automated (unit):** 9 interaction tests against the original's numbers (13 pokes → strain 1.0; 7 slaps on a
full bladder + cough → total failure); cutaway plane removes the near half from front, back, side and above.
**Automated (e2e), `e2e/interactions.spec.js`:** original-vs-port poke and slap; tap/drag poke, tap/swipe slap,
squeeze hold/drag/off-mesh/release, orbit, Slap button, cutaway from behind.
**Gate:** ☑ `npm run check` (0 warnings, 48 unit tests, build) · ☑ e2e 27 passed, 4 skipped.
**Manual:** ☐ poke and slap feel like the original; the cutaway reads well from every angle; the liquid looks like a filled balloon.

---

## M3 — Challenge experience ◐ (automated gate passed; play check pending)

- ☑ ~~Reset before start~~, ~~commute and precision scoring~~, ~~live countdown on the card~~: done in M1.
- ☑ Live challenge banner on the Sim screen above the controls: commute time left + "leaked / 20 ml" (red when
  over) with a time bar; precision shows the instruction.
- ☑ Result card on the Sim screen when a run ends (VICTORY/FAILED/SUCCESS text, "★ New best!", Retry, OK).
  It stays until dismissed, because on a phone the Challenges tab is closed during play.
- ☑ Best results saved on the device (`src/store/persist.js`, storage failures are harmless): commute = fewest
  ml lost on a win, precision = closest to 200 ml; shown on the challenge cards.

**Automated (unit):** 4 tests for best-result rules (`src/challenges/bests.test.js`).
**Automated (e2e), `e2e/challenges.spec.js`:** commute banner → win → result card → best survives a reload;
precision held through the real Empty button to ~200 ml → SUCCESS → Retry restarts it.
**Gate:** ☑ `npm run check` (0 warnings, 52 unit tests, build) · ☑ e2e 29 passed, 4 skipped.
**Manual:** ☐ play both challenges on the phone.

---

## M4 — HUD & visual parity ◐ (automated gate passed; play check pending)

- ☑ Sphincter readout states from the original: COLLAPSE / LEAKING / CLENCHED BRACED / DILATING / STRAINED /
  RESTING, with colours and pulses (`src/components/ui/status.js`).
- ☑ Pressure colour by state; header status badge + subtitle (NOMINAL → DISTENDED → OVERPRESSURE → STRESS LEAK →
  INVOLUNTARY VOID); organ icon grows under stress; red vignette 35 % / 70 % / 95 % pulsing.
- ☑ Bladder wall throbs (emissive pulse) when strain is above 30 %.
- ☑ Settings saved on the device: master mute, voice on/off + volume, **voice gap 3–30 s** (default 10),
  effects on/off + volume, **haptics toggle** (from the original's settings; pulled forward from M5).
- ☑ Starting a challenge no longer says "Just a tiny puddle…" at 580 ml (the original did: its reset spoke).
- ☑ ~~Fluid body lag~~: superseded by M2's water balloon (the liquid fills the sac; slosh inertia moves the wall).
- ☑ ~~Clench exhausted~~, ~~hum pitch~~, ~~creaks~~, ~~10 s voice gap~~, ~~deflated lines~~, ~~Reset voice~~: done in M1.

**Automated (unit):** 12 status tests (readout priority, badge/vignette thresholds at the original's 40 % / 80 %
boundaries); challenge start has no "deflated" line.
**Automated (e2e), `e2e/hud.spec.js`:** seven states set through the debug hook, asserting badge, subtitle, readout
and vignette, with screenshots; settings survive a reload.
**Gate:** ☑ `npm run check` (0 warnings, 67 unit tests, build) · ☑ e2e 37 passed, 4 skipped.
**Manual:** ☐ listen: voice isn't spammy at the default gap; creaks and hum behave; vibration toggle works.

**Found for M6:** on a portrait phone the camera is so close that the bladder fills the whole screen behind the
controls; the subtitle bubble sits on top of the telemetry bar.

---

## M5 — Touch & tactile input ◐ (automated gate passed; phone check pending)

- ☑ Per-finger tracking on the bladder (`pointerId`): fingers that start on a button are ignored, a second finger
  turns the gesture into a pinch and stops the one-finger tool, and presses do their own hit-testing so a second
  finger can never cause a stray poke. Drags keep working off the mesh (M2).
- ☑ True multi-touch: hold Clench or Empty with one thumb while poking with the other. Hold buttons capture their
  finger, so drifting off the edge keeps holding.
- ☑ Gestures: 1 finger = current tool; 2-finger pinch = squeeze (Squeeze tool, original pinch rate) or zoom +
  rotate (other tools). Orbit tool keeps 1-finger rotate.
- ☑ Tool picker is a visible rail on the right edge (radio group: Poke / Squeeze / Slap / Orbit); the cycle button is gone.
- ☑ Browser interference off: page zoom (viewport), pull-to-refresh/overscroll, long-press callout/menu, text selection.
- ☑ All buttons ≥ 44 × 44 px with accessible names (fixes the icon-only buttons from KNOWN_ISSUES).
- ☑ Haptics: ☑ settings toggle (M4); patterns per event were already distinct; ☑ silent no-op where `navigator.vibrate`
  is missing (iOS Safari).
- ☑ Device motion: iOS permission requested on the start tap; "Shake Phone to Slosh" toggle in Settings.

**Automated (e2e), `e2e/touch.spec.js`:** multi-finger touches through the DevTools protocol: two-thumb clench +
poke, held button survives drifting off, pinch-squeeze up and down, pinch-zoom without pokes, tool rail; on every
device: all buttons ≥ 44 px and named, gestures never scroll or zoom the page.
**Gate:** ☑ `npm run check` (0 warnings, 67 unit tests, build) · ☑ e2e 52 passed, 24 skipped (device-scoped).
**Manual:** ☐ two-thumb play, pinch, shake-to-slosh and vibration on a real phone.

**Found for M6:** on iPhone SE the tool rail overlaps the drinks shelf, and the 3D view is a thin strip between
the HUD panels.

---

## M6 — Mobile layout & installable PWA ◐ (automated gate passed; phone check pending)

- ☑ `index.html`: title "Vesica 3D", description, `viewport-fit=cover`, no user zoom, theme colour, Apple
  web-app tags, PNG + SVG favicons; Plus Jakarta Sans / JetBrains Mono fonts wired into Tailwind's theme.
- ☑ Safe-area insets (notch, home bar) on the HUD and the sheets; sheets are capped at `90dvh`.
- ☑ Responsive layout as a CSS grid (`.hud-layout`): portrait stacks top bar → telemetry → **stage** → controls →
  nav; a landscape phone (height ≤ 560 px) moves controls and nav to a right-hand column so the stage keeps the
  full height. Short screens (≤ 640 px) drop the hold-button hint lines.
- ☑ The stage is a real layout area: Cutaway / Cough / Shake / Flush moved into a left **action rail**
  (`ActionRail.jsx`) facing the tool rail; banners and subtitles stack at the top of the stage instead of fixed
  offsets that covered the telemetry bar.
- ☑ **Camera framing** (`stageFit.js` + `StageFit.jsx`): the camera distance fits a fully inflated bladder into
  the stage, and a projection offset centres it on the stage rather than the screen. Starts at the original's
  camera angle; zoom limits and fog scale with the fitted distance.
- ☑ Tabs are bottom sheets (`Sheet.jsx`) on phones, centred panels on wider screens; they scroll inside on short screens.
- ☑ Fullscreen button hidden where the API is missing (iPhone).
- ☑ PWA (`vite-plugin-pwa` 1.3.0): manifest, PNG icons 192 / 512 / maskable / apple-touch-icon (rendered from
  `public/icons/icon.svg` by `tools/make-icons.mjs`), auto-updating service worker that precaches the build and
  caches the fonts on first use; the Install button appears when the browser offers it.
- ☑ Settings persisted locally (M4); screen kept awake during challenges (Wake Lock API, no-op where unsupported).
- ☑ `npm run preview:phone`: production build over HTTPS on the LAN, for the install and offline checks
  (the service worker isn't in the dev server).

**Fixed:** the M0 landscape finding (the expected-failure test is gone; the new test checks the stage centre is
the canvas), the M4 camera-too-close and subtitle-over-telemetry findings, and the M5 iPhone SE overlap.
**Automated (unit):** 2 camera-fit tests (`src/components/3d/stageFit.test.js`).
**Automated (e2e), `e2e/layout.spec.js`** on every device: no horizontal overflow, no overlapping or off-screen
buttons, no clipped button labels (also while clenching and voiding), the stage gets ≥ 20 % of the screen and
≥ 150 px height, a full bladder projects inside the stage at ≥ ⅓ of its height, every tab opens as a sheet that
fits the screen. **`e2e/pwa.spec.js`** against the production build: manifest and icons serve as PNG, the
service worker takes control, the app loads offline.
**Gate:** ☑ `npm run check` (0 warnings, 72 unit tests, build) · ☑ e2e 79 passed, 24 skipped (device-scoped).
**Manual:** ☐ run `npm run preview:phone`, open the printed `https://<LAN-IP>:4173` URL on your phone, add to home
screen, launch it offline, rotate between portrait and landscape.

---

## M7 — Mobile performance ◐ (automated gate passed; phone check pending)

**Measured first** (`npm run test:perf` and the scripts behind it): headless Chromium can reach the real GPU
(RX 6650 XT through ANGLE/Vulkan), so real-GPU runs with CDP CPU throttling measure the JavaScript cost, and
software WebGL (SwiftShader), whose frame rate follows GPU work, stands in for a weak phone GPU. Production
build, Pixel 7 profile:

| | Before M7 | After M7 | Original |
|---|---|---|---|
| Real GPU, 4× slower CPU, voiding + pokes | 60 fps, 11.7 ms main thread / frame | 60 fps, 4.8 ms | 60 fps, 8.2 ms |
| Real GPU, 10× slower CPU, same | — | 57 fps, 14 ms | — |
| Software GPU, idle (High / Medium / Low) | 3.8 fps | 10 / 37 / 52 fps | 6.9 fps |
| Software GPU, full + voiding + pokes (High / Medium / Low) | 2.8 fps (dev server, no pokes) | 6.8 / 25 / 38 fps | 7.3 fps |

M1's "15 vs 2.5 fps" came from the dev server. The real gap was GPU work, ~1.8× the original's: Three.js r185's
**transmission** pass renders the scene again into a multisampled half-float target and builds its mipmaps every
frame (in the original's r128, `transmission` only lowered alpha), and while voiding the stream's `DoubleSide`
transmission ran it twice more. Pixel ratio is the next lever (2 → 1 is 2.4× faster); clearcoat, mesh detail and
material type barely register.

- ☑ **Quality tiers**, Auto by default (`src/settings/quality.js`, `QualityMonitor.jsx`):
  High = pixel ratio ≤ 2 and refractive liquid with the transmission pass at half resolution (indistinguishable
  from full); Medium = ≤ 1.5 and the liquid alpha-blended at 0.9 opacity (matched against High by screenshot,
  and it's what the original's r128 did anyway); Low = 1 and alpha-blended. Auto steps down after two straight 2 s
  windows under 48 fps, ignoring the first 3 s after a start or change (shader compiles), gaps while hidden, and time
  with a sheet open (its blur isn't the device's fault). The tier it settles on is saved, so a slow phone starts
  there next time; Settings → Graphics Quality offers Auto / High / Medium / Low, and picking Auto re-detects.
- ☑ The stream has no transmission in any tier: invisible on a jet that thin.
- ☑ ~~Lower sphere detail~~: dropped. Measured CPU cost is low (57 fps even at 10× CPU throttling) and triangles
  are not where GPU time goes, so it would only cost looks.
- ☑ Per-frame work (`organRig.js`): the liquid reuses the wall's geometry at 0.965 scale (one deformation, one
  normals pass and one upload instead of two); per-vertex constants (fold pattern, jiggle angles via angle-sum
  identities, tremor phases) precomputed; loops on raw arrays; normals computed on raw arrays (same result as
  Three.js, checked bit for bit); ureter tubes rebuilt in place with an arc-length table instead of a new
  `TubeGeometry` and ~200 vectors per frame. Wall, normals, sphincter and stream output are bit-identical to before
  over a 240-frame scripted run.
- ☑ In the background: rendering stops (`frameloop="never"`, so the simulation waits too), the AudioContext is
  suspended and the queued voice line dropped, as in the original; on return a running challenge takes the
  wake lock again (browsers drop it on hide).
- ☑ Code split: `three` (739 kB), `r3f` (168 kB), `react` (178 kB) and app (63 kB) chunks; the 3D scene loads
  lazily behind the HUD and start screen; tabs load on first open. All precached for offline play.

**Found and fixed in M7:** Flush during a challenge left the wake lock on; Retry could lose it (an async
release raced the new request).
**Automated (unit):** 7 Auto-monitor and tier tests (`src/settings/quality.test.js`); normals equal Three.js's,
ureters stay on the moving wall, drops move at an even pace (`organRig.test.js`).
**Automated (e2e), `e2e/lifecycle.spec.js`:** hidden → no rendering, frozen simulation, suspended audio, speech
cancelled, all back on return; wake lock re-taken on return, released by a reset, exactly one after Retry.
**`e2e/quality.spec.js`:** each Graphics option sets the pixel ratio, liquid material and transmission scale, and
survives a reload; Auto re-detects from High.
**Gate (`npm run test:perf`, production build):** real GPU: worst second ≥ 45 fps with 4× CPU throttling during
voiding + pokes, Auto stays on High; JS heap, DOM nodes and listeners flat over 2 minutes of drinks, voiding,
coughs, cutaway and tabs. Software GPU: Auto reaches Low, ≥ 30 fps there, and the next visit starts at Low.
Measured: 60 fps in every one of the 10 seconds; heap 9.6 → 9.2 MB with 506 → 506 DOM nodes and 222 → 222
listeners; Low on software GPU 35 fps (worst second 32).
**Gate:** ☑ `npm run check` (0 warnings, 82 unit tests, build) · ☑ e2e 84 passed, 24 skipped (device-scoped),
stable across 2 runs · ☑ `npm run test:perf` 3 passed, twice. (The e2e helper now allows 20 s for the canvas:
the scene is a lazy chunk and mounts after the load event.)
**Manual:** ☐ play 5 minutes on your phone: smooth, not hot, acceptable battery drain. Check Settings → Graphics
Quality to see which tier Auto chose.

---

## M8 — Minigames (WarioWare-style) ☐

Requested: short, frantic microgames about holding on, built around moving or balancing something.
Each lasts ~5 s, opens with a one-word prompt, speeds up as you win, and costs a "life" (a leak) when lost.

- ☐ Microgame runner: prompt → play → result, lives, rising speed, score, best score saved locally.
- ☐ Touch-first input helpers: drag, tilt (device motion with drag fallback), hold, tap-on-cue.
- ☐ First set of microgames, each tied to holding the sphincter:
  - **BALANCE!**: keep a wobbling, sloshing bladder upright on a pedestal by dragging (or tilting) against the slosh.
  - **HOLD!**: keep the pressure needle in the green band by holding and releasing Clench while urges push it.
  - **DODGE!**: steer the bus left/right to miss potholes (each hit is a cough).
  - **CLENCH!**: clench the instant the sneeze lands, not before.
  - **CARRY!**: walk a brimming cup to the toilet by holding a steady drag speed without spilling.
- ☐ Results feed the bladder sim (a lost microgame = a stress leak), so the 3D organ reacts between rounds.
- Note (2026-10-21): HOLD! and CLENCH! can reuse the arcade's announced urges and sneezes and its timing rules.

**Automated (unit):** each microgame's win/lose logic with scripted input; runner speed-up and lives.
**Automated (e2e):** play each microgame on a phone profile through touch input, win and lose paths.
**Manual:** play a 10-game run on the phone; inputs feel responsive.

---

## M9 — Story mode ☐

Requested: a story mode. A day in the life of one bladder, told in short chapters.

- ☐ Chapter engine: scripted beats (dialogue lines, drinks, urges, challenges, microgames) over the live sim.
- ☐ Chapters: morning coffee → the commute → the long meeting → date night → the concert queue → the road trip finale.
- ☐ The bladder narrates (existing voice and subtitles), with new story lines per chapter.
- ☐ Progress, chapter unlocks and best grades saved locally; resume where you left off.

**Automated (unit):** chapter scripts run to completion with scripted inputs; win/lose branches.
**Automated (e2e):** start chapter 1 from the menu, finish it, chapter 2 unlocks and survives a reload.
**Manual:** play the first two chapters on the phone.

---

## M10 — Release (optional) ☐

- ☐ Replace template `README.md` with real docs (run, test, deploy).
- ◐ Deploy as a static site (HTTPS) for phone access: `.github/workflows/deploy.yml` builds on every push to
  `main` (lint, unit tests, `vite build --base=/vesica/`) and publishes to https://liamthebox.github.io/vesica/.
  Needs Settings → Pages → Source: GitHub Actions.
- ☐ Only if an app-store build is wanted: Capacitor wrapper (native haptics, and native speech on iOS).
