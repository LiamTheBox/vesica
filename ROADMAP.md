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

## M1 — Testable simulation core + event bus ☐

Today the physics lives inside an R3F `useFrame`, and sounds are triggered by React effects
reacting to state changes. That setup caused the bug where a drink sound plays again when a drink
finishes, and it re-renders the whole app at 60 fps. This milestone fixes the architecture first.

- ☐ Extract `src/sim/step.js`: a pure `stepSim(state, dt, rng) → { state, events }`. Port **all** original
  logic order-faithfully, including the parts currently missing (they stay disabled until M2 behind the same code paths).
- ☐ Events emitted by the step: `leakStart/End`, `failureStart/End`, `voidStart/End`, `urgeStart/End`,
  `clenchExhausted`, `pothole`, `creak`, `challengeResult`.
- ☐ One `feedback` dispatcher maps events to audio, voice, haptics and screen shake. Replace the
  effect-based triggers in `useAudioAndHaptics.js`.
- ☐ Performance: `App`/`Scene` no longer subscribe to per-frame values. The HUD reads a telemetry slice
  throttled to ~10 Hz. No per-frame `new THREE.Vector3` in the store.
- ☐ Fix existing lint warnings (refs read during render, missing effect deps in `Organ.jsx`).

**Automated checks (unit):** pressure at fill 0.2/0.5/0.8/1.0 matches original formula; stamina drains
0.22/s and recovers 0.16/s; void starts after exactly 1.0 s; stress leak fires only above capacity with
fill > 0.5; involuntary void stops at 70 ml and resets strain/stamina.
**Automated (e2e):** `App` renders ≤ 2× per second while idle (render counter via debug hook).
**Manual:** play for 2 minutes; it should feel identical to before (no gameplay change yet).

---

## M2 — Restore difficulty mechanics ☐

- ☐ **Urge waves:** timer (18 s → 7 s as fill rises), only above 45 % fill, 3.5 s spasm ramp (+24 cmH₂O),
  rumble sound, "Detrusor contraction wave" alert driven by the real state.
- ☐ **Poke/slap add sphincter strain** (+0.08 / +0.15) and use original strengths (poke `squishForce` 2.2,
  slap power ×2.2, dent caps 0.6 / 0.8, original slosh and jiggle).
- ☐ Drag-to-poke and swipe-to-slap (speed > 10 px).
- ☐ Slap button goes through the same `slapBladder` path; delete dead `handleSlap` in `ActionButtons.jsx`.
- ☐ **Cough** and **Soothe** get full feedback (sound, voice, haptic, shake, slosh, ripple).
  Commute potholes = cough + agitation.
- ☐ Shake: ripple + fluid core velocity; the "shaken" line only when strength > 2 and fill > 40 %.
- ☐ Orbit drag imparts slosh again.

**Automated (unit):** urge wave starts within 18 s at 50 % fill and raises pressure; not below 45 %;
13 pokes push strain to 1.0; strain 1.0 + high fill + cough → involuntary void.
**Automated (parity):** run the same scripted inputs on the original and the port; key values
(volume, pressure, strain) agree within tolerance.
**Manual:** fill to ~70 % and wait; urge alert and rumble appear; spam pokes until a leak happens.

---

## M3 — Challenges that finish ☐

- ☐ Starting a challenge fully resets the organ (drinks, strain, dilation, urge timer, dents).
- ☐ **Commute:** live countdown, pothole every 7–11 s, VICTORY if ≤ 20 ml leaked else FAILED.
- ☐ **Precision void:** scored on release of a single continuous void; ±10 ml of 200 ml = success.
- ☐ Result toast on the Sim screen (on mobile the Challenges tab is closed during play), plus result
  kept on the challenge card.
- ☐ Best results saved locally.

**Automated (unit):** scripted 60 s commute with/without clenching yields VICTORY / FAILED; precision void
held for computed duration scores correctly.
**Automated (e2e):** start each challenge from the tab and see the toast at the end.
**Manual:** play both challenges on your phone.

---

## M4 — Feedback & HUD parity ☐

- ☐ Sphincter readout states: COLLAPSE / LEAKING / CLENCHED / DILATING / STRAINED / RESTING, with colours.
- ☐ Pressure colour by state; header status badge + subtitle (NOMINAL → DISTENDED → OVERPRESSURE →
  STRESS LEAK → INVOLUNTARY VOID); red vignette from 80 % fill.
- ☐ "CLENCH EXHAUSTED!" label; clench hum pitch follows stamina; strain creaks above 46 cmH₂O;
  bladder glow pulse under strain.
- ☐ Voice: back to a 10 s minimum gap (adjustable in Settings). Only important events (leak, failure, void
  start) may interrupt; pokes never interrupt. "Deflated" after a void ending below 150 ml and after a failure.
- ☐ Reset says the "deflated" line, not "shaken".
- ☐ Fluid body lags behind the wall again (fluid core offset), as in the original.

**Automated (e2e):** for each state (nominal, distended, overpressure, leak, collapse), set it via the debug
hook, then assert badge/readout text and take a screenshot. Compare with the original in the same state.
**Manual:** listen: voice isn't spammy, creaks and hum behave.

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
- ☐ Haptics: toggle in Settings respected everywhere; distinct patterns; silent no-op where unsupported (iOS Safari).
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

- ☐ Quality tiers (auto-adapting): pixel-ratio cap, lower sphere detail, cheaper materials (no transmission)
  on weak devices.
- ☐ Remove per-frame allocations in the vertex loops; one normals pass per mesh per frame.
- ☐ Pause rendering and audio when the app is hidden.
- ☐ Code-split the 1.15 MB bundle (Three.js chunk, lazy tabs).

**Automated (e2e):** with 4× CPU throttling on a phone profile, sustained ≥ 45 fps over 10 s of active play;
memory stable over 2 minutes.
**Manual:** play 5 minutes on your phone. It should stay smooth, the phone shouldn't get hot, and battery drain should be acceptable.

---

## M8 — Release (optional) ☐

- ☐ Replace template `README.md` with real docs (run, test, deploy).
- ☐ Deploy as a static site (HTTPS) for phone access.
- ☐ Only if an app-store build is wanted: Capacitor wrapper (native haptics, and native speech on iOS).
