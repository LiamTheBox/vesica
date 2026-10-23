# Vesica 3D — Roadmap

Goal: make the React/Vite port play like the original single-file game (`Vesica 3D Mobile Web App.html`), then
make it a solid touch-first mobile app (installable, offline PWA).

Every milestone ended with a **gate**: `npm run check` green, that milestone's automated checks, a manual check on a
real phone, and a commit tagged `m<N>`. This file keeps what's still open. What each milestone built, and the
numbers measured on the way, are in its commits (`git log m<N-1>..m<N>`, `git show m<N>`).

Status legend: ☐ todo · ◐ in progress · ☑ done

## Where things stand (2026-10-23)

- **M0–M9:** code done, automated gates passed, tagged `m0`–`m9`. Every **phone check is still open** (below).
- **Tests:** `npm run check` green (264 unit tests). The browser suite (`npm run test:e2e`) isn't required for now
  (your choice: it loads the CPU). Its specs follow the code but last ran before the 2026-10-21 changes (85 passed).
- **Live:** https://liamthebox.github.io/vesica/, deployed by GitHub Actions on every push to `main`. From at
  least 2026-10-21 until 2026-10-23 it showed only a blank screen (see KNOWN_ISSUES), so the phone checks below
  couldn't have been done on it before then.
- **Rules for everything new** (requested 2026-10-21): fully offline (nothing loaded from the network); every mode
  plays with one pointer, touch or mouse (tap, hold, drag; Space presses on a keyboard; pinch, wheel and right-drag
  only move the camera); the minigames are abstract sphincter-control challenges, and any story stays outside them,
  optional to read. Safe for work: adults, no nudity or sexual framing.
- **Next:** the phone checks.

## Done

| | What | Tag |
|---|---|---|
| M0 | Baseline; Vitest, and Playwright with phone emulation; the dev hook (`window.__vesica`); constants checked against the original | `m0` |
| M1 | The original's simulation ported line by line, with an event bus; no React render per frame | `m1` |
| M2 | Poke and slap as in the original; a water-balloon wall; the cutaway from any angle; a sphincter ring above a urethra | `m2` |
| M3 | Live challenge banner, result card, best results kept on the device | `m3` |
| M4 | The original's HUD states and red vignette; settings kept on the device | `m4` |
| M5 | Per-finger touch, pinch, the tool rail, 44 px buttons, haptics, shake to slosh | `m5` |
| M6 | Mobile layout grid, camera framed to the stage, bottom sheets, installable PWA | `m6` |
| M7 | Quality tiers (Auto), per-frame work cut, pause in the background, code split | `m7` |
| M8 | Microgames: eleven one-pointer games about sphincter control | `m8` |
| M9 | Stories: six optional chapters in their own sheet | `m9` |

Requested along the way, each in its own commits:

- **2026-10-20:** urine scaled to the volume held, over a thick wall, with shaded cut faces; Kegel recovers 4× faster
  and eases sphincter strain while held.
- **2026-10-21:** new physiology (slow kidney fill, steeper pressure, tone-gated leaks, freeze and squeeze, 20 ml/s
  flow); arcade mode as the default; camera pan and closer zoom; a new urine stream; one organ surface with a
  contracting detrusor; ureters with peristalsis; a 40-drink menu; reactions and emotions (voice priority, lines
  for the silent moments, mood, body language, feel by fill, rewritten lines); an arcade bladder without a limit;
  the microgames banner in the telemetry bar's place.
- **2026-10-21, from the backlog:** offline fonts and voice; the voice in its own module, with a voice picker;
  subtitles timed to the line; every line chosen in `reactions.js`; drinks with one source; a Wall Feel setting;
  `organRig.js` split in four; a strained body trembles; at most 12 ripples; reduced motion; body language you can
  hear; plain words across the app; reactions to the camera; pleading and sulking when held full; a mood strip and
  line log on the Pressure Chart.
- **2026-10-22, from the backlog (approved):** the arcade serves the whole drinks menu by level, and caffeine
  brings urges sooner while alcohol tires the clench (in every mode); three personalities (dramatic, shy,
  deadpan) and a name for the bladder; fourteen stickers kept on the device; every interface word in one English
  table (`src/i18n/en.js`), ready for a translation; colour emoji on Linux desktops.
- **2026-10-22, requested:** at 100 % strain the sphincter holds on for 5 s before it gives way, in every mode.
  The countdown doesn't show (no SLIPPING! alert, sound or line: only the readout at 100 %), stops while a clench
  holds, and starts over once the strain is below 100 %. In the arcade (approved), a clench that catches it running
  costs stamina and leaves the grip shaky (SHAKY by the stamina bar), as does a clench that gives out, and Soothe
  takes 25 s to come back.
- **2026-10-23, requested:** the bladder takes the realistic model's shape (measured from its front and side
  renders; no model file is used): a flattened dome widest a third of the way down, a funnel, and a urethra (the
  model's, shortened) with the sphincter ring where it leaves the funnel. It fills like an anatomy book's bladder,
  flat-topped when nearly empty and round when full, and while voiding its dome pushes down into a hollow, a little
  in an urge wave. The ureters come down beside it into its upper sides, in the same creased red tissue as the
  wall. The urine is smooth and glossy, with shimmering light drifting through it (it had the lining's folds), and
  no longer shows through the wall around a ureter after a squirt. The camera frames the new shape.

## Open: phone checks

On the live site (or `npm run preview:phone` for installing and offline). Tick them here as you go.

- ☐ **M0:** the app loads and the start tap works.
- ☐ **M1:** urge banner and rumble from ~45 % full, leaks under coughs, chatter no more than every 30 s, challenges
  report their results.
- ☐ **M2:** poke and slap feel right; the cutaway reads well from every angle; the urine looks like a filled balloon.
- ☐ **M3:** play both challenges.
- ☐ **M4:** listen: creaks and the clench hum behave; the vibration toggle works.
- ☐ **M5:** two-thumb play, pinch, shake to slosh and vibration.
- ☐ **M6:** add to the home screen, launch it offline, rotate between portrait and landscape.
- ☐ **M7:** play 5 minutes: smooth, not hot, acceptable battery drain. See which tier Settings → Graphics Quality
  chose.
- ☐ **M8:** a 10-game microgames run with a finger, and one with a mouse.
- ☐ **M9:** read a chapter: comfortable text size and scrolling.
- ☐ **2026-10-21:** a few arcade runs; pan to the sphincter with two fingers; watch a void and a leak.
- ☐ **Backlog work (2026-10-21):** Settings → Voice lists the phone's voices and the chosen one talks offline;
  each Wall Feel feels different; opening the cutaway gets a line and a blush; the Pressure Chart's mood strip
  fills in.
- ☐ **Backlog work (2026-10-22):** each personality sounds right on the phone (shy quieter, deadpan flat); the
  name field takes typing on an iPhone and shows on the subtitles; a sticker shows when earned and in the
  Challenges list; ☕ and 🍺 show by the telemetry bar after coffee or beer, and the arcade serves them from
  level 3 and 5.
- ☐ **Arcade balance and the leak countdown (2026-10-22):** reaching 100 % strain no longer leaks at once but
  about 5 s later, with nothing shown but the readout; a few honest arcade runs end somewhere around 4–6 minutes,
  and waiting for 100 % loses in a minute or two; SHAKY shows in amber by the stamina bar after a close call or a
  clench that gives out.
- ☐ **The realistic bladder (2026-10-23):** it looks like the model on the phone, the creases sharp; it rounds out
  as it fills and its top pushes down into a hollow while voiding; the urine reads as liquid; the ureters join its
  upper sides with no yellow patch after a squirt; the whole organ fits the stage in portrait and landscape.

## M10 — Release (optional) ◐

- ☑ README with real docs (run, test, deploy).
- ◐ Static site over HTTPS: `.github/workflows/deploy.yml` builds on every push to `main` (lint, unit tests,
  `vite build --base=/vesica/`, then opens the build in a headless browser and stops unless the app starts) and
  publishes to GitHub Pages. Check that Settings → Pages → Source is "GitHub Actions", or the old branch publish
  can overwrite the app.
- ☐ Only if an app-store build is wanted: a Capacitor wrapper (native haptics, and native speech on iOS).

## Reference

What was measured or learned on the way that the code doesn't show:

- **Performance (M7, production build, Pixel 7 profile).** Real GPU with a 4× slower CPU, voiding and poking:
  60 fps at 4.8 ms of main thread a frame (11.7 ms before M7; the original 8.2 ms). Software GPU, a stand-in for a
  weak phone, same scene: 6.8 / 25 / 38 fps on High / Medium / Low (the original 7.3). The gap was Three.js r185's
  transmission pass. `npm run test:perf` is the gate: worst second ≥ 45 fps on the real GPU, ≥ 30 fps on Low.
- **Arcade balance** (2026-10-22, with the 5 s leak countdown; `node tools/arcade-bots.mjs`: scripted players
  reacting in 0.2–0.4 s, 20 runs each). Median time to lose: never clenching 1:14; clenching only once the readout
  shows 100 % 1:08; calming 1 wave in 4 1:18; holding Clench down for good 4:05; clenching as each wave lands, not
  on the warning, 5:15; a typical player (85 % of warnings, 60 % of sneezes, Soothe at 70 % strain) 5:43, from 3:43
  to 8:06. A strong player (95 % / 90 %) mostly lasts past 20 minutes and a flawless one never loses: nothing gets
  harder after level 11 (5 minutes). Reactions of 0.22 or 0.38 s change these little. The save cost hardly moves
  the typical player; Soothe's cooldown does (20 s: 6:36). Before the save cost and the countdown: SLIPPING! only
  ~4:10, a typical player ~6:30 (a quarter lasted 10 minutes), holding Clench down ~6:50. A10's drinks raised
  5-minute scores 2–9 % and changed nothing else. The commute challenge is much easier under the 2026-10-21 rules,
  and easier again with the countdown (a pothole at 100 % no longer leaks at once).
- **Browser tests:** headless WebGL is software-rendered at a few fps, so timing-dependent specs pause the loop and
  step simulated time (`window.__vesica.step(n)`).
- **Local setup:** VS Code runs as a Flatpak and sets `XDG_CACHE_HOME`, so
  `~/.var/app/com.visualstudio.code/cache/ms-playwright` is a symlink to `~/.cache/ms-playwright`.
