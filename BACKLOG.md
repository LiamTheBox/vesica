# Backlog: cleanups and additions

Things worth doing that nobody has asked for yet. Open bugs live in [KNOWN_ISSUES.md](KNOWN_ISSUES.md), the open
phone checks in [ROADMAP.md](ROADMAP.md).

Done on 2026-10-21 and removed from this list (see `git log`): C1–C7, C9, C11, C12, C14 and A1–A9. C10 (a
formatter) was tried and dropped. On a copy, Prettier rewrote 53 of the 60 source files (+1,545/−415 lines), one
string per line in `lines.js`. The one file out of step with the hand style (`constants.js`) was fixed by hand.

Effort: **S** = under an hour, **M** = an afternoon, **L** = a day or more.

## Cleanups

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C8 | **Four tables react to the same events:** sounds and haptics (`handlers`), the body's moves (`emotes.js`) and their sounds (`EMOTE_SOUNDS`), and the lines (`LINE_FOR`). They're small and all in `src/feedback/` now, so this can wait. If they grow, one table per event (sound, haptic, line, move) would show at a glance what an event does. | [feedback.js](src/feedback/feedback.js), [emotes.js](src/feedback/emotes.js), [reactions.js](src/feedback/reactions.js) | Spotting gaps | M |
| C13 | **Browser tests, if they come back** (off for now: they load the CPU). The specs follow the 2026-10-21 wording but haven't run since. Add a check that the HUD face (`data-testid="mood"`) changes with the mood. | [e2e/](e2e) | The newer UI is only unit-tested | M |

## Additions waiting for a yes

Each of these changes how the game plays or looks, so none is started until it's wanted.

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| A10 | **Drinks in the arcade.** It serves only the shelf's four. Serve from the 40 by level (gentle ones early, diuretics and big ones later), and give drink kinds an effect beyond volume and speed: caffeine brings urges sooner, alcohol tires the clench. Changes the arcade's balance. | [arcade.js:47](src/sim/arcade.js#L47), [drinks.js](src/sim/drinks.js) | The menu matters in the default mode | M |
| A11 | **Personalities.** Line sets with a different temperament (dramatic, shy, deadpan), and a name for the bladder, picked in Settings. The lines are one table by kind, so a personality is a second table. | [lines.js](src/audio/lines.js), [SettingsTab.jsx](src/components/ui/Tabs/SettingsTab.jsx) | Replay value; shows off the moods | M |
| A12 | **Stickers.** Small achievements kept on the device, like "Held 700 ml", "10 perfect clenches", "Banked a run without a leak" and "Beat a microgames boss". The bests store already persists results. | [bests.js](src/challenges/bests.js), [ChallengesTab.jsx](src/components/ui/Tabs/ChallengesTab.jsx) | Goals beyond the score | M |
| A13 | **A face on the model** (optional, toggleable): simple eyes on the dome that follow the camera and take the mood's shape (sleepy lids, wide panic eyes, a blush under them). | [bodyLanguage.js](src/components/3d/bodyLanguage.js), [Organ.jsx](src/components/3d/Organ.jsx) | The strongest emotional read; a style choice | L |
| A14 | **Translated lines and UI.** Every string is inline English and the lines are one table, so a translation needs an `i18n` lookup and a voice in that language. Which languages? | [lines.js](src/audio/lines.js), components | Reach | L |
