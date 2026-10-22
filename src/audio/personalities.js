import { LINES, NORMAL_VOICE, URGENT, VOICE_STYLE } from './lines'
import { SHY_LINES } from './linesShy'
import { DEADPAN_LINES } from './linesDeadpan'

// Who the bladder is (A11): which lines it says, and how it says them. Picked in Settings;
// dramatic is the one it always had. Every personality has every kind of line in lines.js.
export const PERSONALITIES = {
  dramatic: {
    label: 'Dramatic',
    hint: 'Loud, neurotic, a little much',
    lines: LINES,
    volume: 1,
    sample: "Hi! It's me. Your bladder.",
    styleOf: (category) => VOICE_STYLE[category] ?? NORMAL_VOICE,
  },
  shy: {
    label: 'Shy',
    hint: 'Quiet, polite, easily embarrassed',
    lines: SHY_LINES,
    volume: 0.8,
    sample: "Um... hi. It's me.",
    styleOf: (category) => (URGENT.has(category) ? { pitch: 1.45, rate: 1.0 } : { pitch: 1.35, rate: 0.9 }),
  },
  deadpan: {
    label: 'Deadpan',
    hint: 'Flat, dry, never impressed (not even now)',
    lines: DEADPAN_LINES,
    volume: 1,
    sample: "Hello. I'm a bladder.",
    styleOf: () => ({ pitch: 0.95, rate: 0.95 }),
  },
}

export const personalityOf = (key) => PERSONALITIES[key] ?? PERSONALITIES.dramatic
