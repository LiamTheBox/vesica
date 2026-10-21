# Backlog: cleanups and additions

Things worth doing that nobody has asked for yet, collected on 2026-10-21 after the reactions work (phases A–F in
[ROADMAP.md](ROADMAP.md)). Open bugs live in [KNOWN_ISSUES.md](KNOWN_ISSUES.md); planned milestones (phone checks,
M8 minigames) in the ROADMAP. Nothing here is started.

Effort: **S** = under an hour, **M** = an afternoon, **L** = a day or more.

## Cleanups

### Worth doing first

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C1 | **The wall's strain tremor is invisible.** The wall's springs lag ~0.7 s behind their targets, so the 37–43 Hz tremor reaches the surface at under 1 % of its size (measured while building D: a 0.06 shake moved vertices 0.0002 a frame). The same filtering shrinks the jiggle to about a tenth. Either drop the per-vertex tremor (its arrays and six trig terms per vertex) or move a gentle strain shake onto the body group, as D did for the shudder. Leave the sphincter twitch alone: it's applied directly and shows. | [organRig.js:349](src/components/3d/organRig.js#L349), [organRig.js:547](src/components/3d/organRig.js#L547) | Per-frame work for no visible effect; strain looks calmer than intended | S |
| C2 | **Voice logic still lives in the simulation.** `sim.js` pushes `voice` events (`deflated` after voiding or a reset, `cough`), computes `speakShaken` in `agitate`, has `resetOrgan`'s `silent` option only for that line, and exports `ambientVoiceCategory`. Since B and C, `src/feedback/reactions.js` picks every line, so these can move there (map `voidStop`, `reset` and `cough` directly). The sim would then be pure physiology. | [sim.js:193](src/sim/sim.js#L193), [sim.js:239](src/sim/sim.js#L239), [sim.js:262](src/sim/sim.js#L262), [sim.js:568](src/sim/sim.js#L568) | Two places decide what's said; the M1 voice-threshold tests would move with it | M |
| C3 | **The shelf's drinks are defined twice.** `BEVERAGE_TYPES` in `physics/constants.js` holds the four shelf drinks, `drinks.js` copies them, and the shelf buttons read `BEVERAGE_TYPES`. Make `drinks.js` the single source (with a `SHELF` list) and keep the original's numbers only in the parity test. | [constants.js](src/physics/constants.js), [ActionButtons.jsx:52](src/components/ui/ActionButtons.jsx#L52), [drinks.js](src/sim/drinks.js) | One place to change a drink | S |
| C4 | **Three of the four physics presets are unreachable.** `balloon`, `anatomical` and `highTension` have no setting, so only `jello` is ever used. Delete them or expose them (see A9). | [constants.js](src/physics/constants.js), [sim.js:127](src/sim/sim.js#L127) | Dead configuration | S |
| C5 | **Dead field:** `AudioManager.creakCooldown` is counted down but never set or read; the sim has its own. | [AudioManager.js:41](src/audio/AudioManager.js#L41) | Dead code | S |

### Structure and style

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C6 | **Split `organRig.js` (740 lines).** It holds the canvas textures, the organ geometry, the soft-body wall, the sphincter, the urine transform, ureter routing, the stream outlet, body language (D) and feel (E). Natural pieces: `textures.js`, `organGeometry.js`, `bodyLanguage.js` (breathing, springs, `emoteFor`), with `organRig.js` as the per-frame loop. | [organRig.js](src/components/3d/organRig.js) | Easier to find and change one behaviour | M |
| C7 | **Split `AudioManager.js` into voice and effects.** The voice scheduling (A) shares a class with a dozen Web Audio recipes written as dense one-liners that each repeat the same mute check, `initCtx()` and `currentTime` lines. Move the voice into `voice.js`, and give the effects a small helper that returns the time (or nothing when muted). | [AudioManager.js](src/audio/AudioManager.js) | Reads like the rest of the code; the voice can be tested on its own | M |
| C8 | **Three tables react to the same events.** Sounds and haptics (`handlers` in `feedback.js`), lines (`reactions.js`) and body moves (`emoteFor` in `organRig.js`) are each keyed by event type in a different file. That's fine while they stay small. If they grow, one reaction table per event (sound, haptic, line, emote) would show at a glance what an event does. | [feedback.js](src/feedback/feedback.js), [reactions.js](src/feedback/reactions.js), [organRig.js](src/components/3d/organRig.js) | Spotting gaps, as in B | M |
| C9 | **Rename the `deflated` lines to `emptied`.** They're said just after voiding or a reset; "deflated" reads like an emotion. | [lines.js](src/audio/lines.js), [Alerts.jsx](src/components/ui/Alerts.jsx), [sim.js](src/sim/sim.js) | Clearer names | S |
| C10 | **No formatter.** Style is consistent by hand except `physics/constants.js` (semicolons) and AudioManager's one-liners. A formatter (oxfmt or Prettier) in `npm run check` would keep it that way. | [constants.js](src/physics/constants.js), [package.json](package.json) | Consistency without effort | S |

### Performance (small)

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C11 | The lining's normals and seam are recomputed every frame even when the urine is hidden (an empty bladder). Skip them when `urine.visible` is false. | [organRig.js](src/components/3d/organRig.js) (end of `update`) | Half the per-frame normal work, when empty | S |
| C12 | Each ripple is tested against all ~2,700 wall vertices every frame; a slap swipe adds dozens of ripples. Cap the ripple count, or merge ripples that start close together. | [organRig.js](src/components/3d/organRig.js), [interactions.js](src/sim/interactions.js) | A swipe can stack up frame cost on weak phones | S |

### Tests

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C13 | **The browser suite hasn't run since the 2026-10-21 changes** (your choice: it loads the CPU). When there's a quiet moment, run it once. The settings test was updated for the renamed chat-gap slider but never run. Add one check that the HUD face (`data-testid="mood"`) changes with the mood. | [e2e/](e2e), [hud.spec.js](e2e/hud.spec.js) | The new UI is only unit-tested | M |
| C14 | `feedback.js`'s wiring (event → sound → mood → line) has no test; only its pure parts (`mood.js`, `reactions.js`) do. Exporting `onEvent` would allow a node test with a stubbed `audio`. | [feedback.js](src/feedback/feedback.js) | Catches a handler that stops speaking | S |

## Additions

### Small, in the spirit of A–F

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| A1 | **Plain-language UI copy.** F rewrote the lines, but the banners and status still read like an instrument: "DETRUSOR CONTRACTION WAVE INCOMING!", "App Runtime • Hydro-Acoustics", "Equilibrating peak overpressure...", "High retention wall stress", "Procedural Hydro-Acoustics". `hud.spec.js` asserts the status texts, so update it too. | [Alerts.jsx:72](src/components/ui/Alerts.jsx#L72), [status.js](src/components/ui/status.js), [SettingsTab.jsx](src/components/ui/Tabs/SettingsTab.jsx) | One voice across the app | S |
| A2 | **Sounds and buzzes for the body language.** D's moves are silent: a soft exhale on a sigh, a small "boing" and a short buzz on a happy bounce, a shiver sound before a warned urge. | [AudioManager.js](src/audio/AudioManager.js), [feedback.js](src/feedback/feedback.js) | The moves land harder with sound | S |
| A3 | **Subtitles that last as long as the line.** They show for a fixed 5 s, so a two-word line lingers and a long one can be cut short by the next. `AudioManager.speak` already estimates each line's length. | [Alerts.jsx:23](src/components/ui/Alerts.jsx#L23) | Fits the new short lines | S |
| A4 | **Accessibility.** Give the subtitle bubble `aria-live="polite"`, so screen readers hear the bladder too. Honour `prefers-reduced-motion`: soften the screen shake and the body language's shudder and shiver. | [Alerts.jsx](src/components/ui/Alerts.jsx), [index.css](src/index.css), [organRig.js](src/components/3d/organRig.js) | Nothing handles either today | S |
| A5 | **Reactions to the camera and the cutaway.** "Hey! Privacy!" when the cutaway opens, "Too close!" when zoomed right in, dizziness after a long orbit. | [reactions.js](src/feedback/reactions.js), [lines.js](src/audio/lines.js) | More moments that feel noticed | S |
| A6 | **It gets impatient when ignored.** Full for minutes without a void, the chatter could escalate from hints to pleading to sulking. | [reactions.js](src/feedback/reactions.js), [mood.js](src/feedback/mood.js) | Gives long sandbox sessions an arc | S |

### Bigger

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| A7 | **Mood on the Telemetry tab:** a strip of the last few minutes' moods under the pressure chart, and the last 20 lines said (a subtitle log). | [TelemetryTab.jsx](src/components/ui/Tabs/TelemetryTab.jsx), [feedback.js](src/feedback/feedback.js) | The mood is otherwise a fleeting face | M |
| A8 | **Voice choice in Settings.** The voice is the first installed one whose name matches a keyword list, so on many phones it's an arbitrary system voice. List the installed English voices and remember the choice. | [AudioManager.js:91](src/audio/AudioManager.js#L91), [SettingsTab.jsx](src/components/ui/Tabs/SettingsTab.jsx) | The voice is the character | M |
| A9 | **A "wall feel" setting** using the unused presets (C4): jelly, balloon, anatomical, tense. E's fill-dependent feel layers on top of each. | [constants.js](src/physics/constants.js), [SettingsTab.jsx](src/components/ui/Tabs/SettingsTab.jsx) | Puts dead config to use | S |
| A10 | **Drinks in the arcade.** It serves only the shelf's four. Serve from the 40 by level (gentle ones early, diuretics and big ones later), and give drink kinds an effect beyond volume and speed. For example, caffeine brings urges sooner and alcohol tires the clench. | [arcade.js:43](src/sim/arcade.js#L43), [drinks.js](src/sim/drinks.js) | The menu matters in the default mode | M |
| A11 | **Personalities.** Line sets with a different temperament (dramatic, shy, deadpan), and a name for the bladder. The lines are already one table by kind, so a personality is a second table. | [lines.js](src/audio/lines.js), [SettingsTab.jsx](src/components/ui/Tabs/SettingsTab.jsx) | Replay value; shows off C's moods | M |
| A12 | **Stickers.** Small achievements kept on the device, like "Held 700 ml", "10 perfect clenches", "Survived a beer pitcher" and "Never leaked a drop in a run". The bests store already persists results. | [bests.js](src/challenges/bests.js), [ChallengesTab.jsx](src/components/ui/Tabs/ChallengesTab.jsx) | Goals beyond the score | M |
| A13 | **A face on the model** (optional, toggleable): simple eyes on the dome that follow the camera and take the mood's shape (sleepy lids, wide panic eyes, a blush under them). It carries C and D on the bladder itself, not only on the HUD. | [organRig.js](src/components/3d/organRig.js), [Organ.jsx](src/components/3d/Organ.jsx) | The strongest emotional read; a style choice for you | L |
| A14 | **Translated lines and UI.** Every string is inline English, and the lines are in one table, so a translation needs an `i18n` lookup and a voice in that language. | [lines.js](src/audio/lines.js), components | Reach | L |
