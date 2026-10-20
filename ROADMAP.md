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

## M5 — Touch & tactile input ☐

- ☐ Pointer capture on the bladder: a squeeze/drag doesn't drop when the finger slides off the mesh.
- ☐ True multi-touch: hold Clench or Empty with one thumb while poking with another finger
  (track by `pointerId`, capture on buttons so small finger movement doesn't cancel the hold).
- ☐ Gestures: 1 finger = current tool; 2-finger pinch = squeeze (squeeze tool) or zoom (others);
  2-finger drag = orbit in any tool.
- ☐ Tool picker becomes a visible segmented control (Poke / Squeeze / Slap / Orbit), not a cycle button.
- ☐ Kill mobile browser interference: long-press callout and text selection, double-tap zoom,
  pull-to-refresh/overscroll, context menu on hold buttons.
- ☐ All tap targets ≥ 44 × 44 px.
- ◐ Haptics: ☑ toggle in Settings (M4); ☐ distinct patterns; ☐ silent no-op where unsupported (iOS Safari).
- ☐ Device motion: request iOS permission on the start tap; "Shake phone to slosh" toggle.

**Automated (e2e, touch emulation):** tap, two-thumb hold (Clench held while poking) via multi-touch
events, pinch to squeeze raises pressure, drag off-mesh keeps squeeze, no page scroll/zoom after gestures.
**Manual:** checklist on a real phone: two-thumb play, pinch, shake-to-slosh, vibration.

---

## M6 — Mobile layout & installable PWA ☐

- ☐ `index.html`: proper title, `viewport-fit=cover`, no user zoom, theme colour, Apple web-app tags, fonts.
- ☐ Safe-area insets (notch, home bar), `100dvh` layout.
- ☐ Responsive layouts: small portrait phone (360 × 640), large phone, landscape phone (controls move to
  side rails), tablet.
- ☐ Tabs become bottom sheets that scroll on short screens.
- ☐ Hide Fullscreen where the API is unsupported (iPhone).
- ☐ PWA: manifest with PNG icons (192, 512, maskable, apple-touch-icon), service worker for offline play,
  working Install button.
- ☐ Settings persisted locally; screen kept awake during challenges.

**Automated (e2e):** on every device profile there's no horizontal overflow, no overlapping controls
(bounding-box checks), all controls on screen; manifest and service worker register; works offline after first load.
**Manual:** add to home screen on your phone, launch offline, rotate.

---

## M7 — Mobile performance ☐

**Measured in M1:** in headless (software-rendered) Chromium the original runs at **~15 fps** and the port at
**~2.5 fps** on the same machine. Suspects: the port deforms a second 64×48 sphere for the fluid every frame
(the original's fluid is a static 48×36 sphere), and Three.js r185's transmission pass costs more than r128's.
Confirm on real hardware first; if a phone shows the same gap, move this milestone earlier.

- ☐ Quality tiers (auto-adapting): pixel-ratio cap, lower sphere detail, cheaper materials (no transmission)
  on weak devices.
- ☐ Remove per-frame allocations in the vertex loops; one normals pass per mesh per frame.
- ☐ Pause rendering and audio when the app is hidden.
- ☐ Code-split the 1.15 MB bundle (Three.js chunk, lazy tabs).

**Automated (e2e):** with 4× CPU throttling on a phone profile, sustained ≥ 45 fps over 10 s of active play;
memory stable over 2 minutes.
**Manual:** play 5 minutes on your phone. It should stay smooth, the phone shouldn't get hot, and battery drain should be acceptable.

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
- ☐ Deploy as a static site (HTTPS) for phone access.
- ☐ Only if an app-store build is wanted: Capacitor wrapper (native haptics, and native speech on iOS).
