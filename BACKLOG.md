# Backlog: cleanups and additions

Things worth doing that nobody has asked for yet. Open bugs live in [KNOWN_ISSUES.md](KNOWN_ISSUES.md), the open
phone checks in [ROADMAP.md](ROADMAP.md).

Done and removed from this list (see `git log`):
- **2026-10-21:** C1–C7, C9, C11, C12, C14 and A1–A9.
- **2026-10-22:** A10–A12 and A14 (English only for now).

Dropped:
- **C10 (a formatter):** on a copy, Prettier rewrote 53 of the 60 source files (+1,545/−415 lines), one string per
  line in `lines.js`. The one file out of step with the hand style (`constants.js`) was fixed by hand.
- **A13 (a face on the model):** no faces on the bladder (your call, 2026-10-22).

Effort: **S** = under an hour, **M** = an afternoon, **L** = a day or more.

## Cleanups

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| C8 | **Four tables react to the same events:** sounds and haptics (`handlers`), the body's moves (`emotes.js`) and their sounds (`EMOTE_SOUNDS`), and the lines (`LINE_FOR`); the stickers read events too. They're small and all in `src/feedback/` and `src/challenges/`, so this can wait. If they grow, one table per event (sound, haptic, line, move) would show at a glance what an event does. | [feedback.js](src/feedback/feedback.js), [emotes.js](src/feedback/emotes.js), [reactions.js](src/feedback/reactions.js) | Spotting gaps | M |
| C13 | **Browser tests, if they come back** (off for now: they load the CPU). The specs follow the 2026-10-21 wording but haven't run since. Add a check that the HUD face (`data-testid="mood"`) changes with the mood. | [e2e/](e2e) | The newer UI is only unit-tested | M |

## Additions

| # | What | Where | Why | Effort |
|---|---|---|---|---|
| A15 | **A second language**, when wanted. The groundwork is in (A14): a translated copy of `src/i18n/en.js` in `LANGUAGES`, lines for each personality, the stories, and a voice that speaks it. A language switch in Settings would come with it. | [src/i18n/](src/i18n), [lines.js](src/audio/lines.js) | Reach | L |
