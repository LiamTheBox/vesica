import { describe, expect, it } from 'vitest'
import { initialHud } from '../../store/useUiStore'
import { organStatus, sphincterReadout } from './status'

const hud = (over) => ({ ...initialHud, ...over })

describe('sphincter readout (original updateUI priority order)', () => {
  it.each([
    [{ involuntaryVoiding: true, isStressLeaking: true }, 'COLLAPSE (100%)'],
    [{ isStressLeaking: true, isClenching: true, tonePct: 25 }, 'LEAKING (25% Strain)'],
    [{ leakGrace: true, isClenching: false, tonePct: 100 }, 'SLIPPING (100%)'],
    [{ isClenching: true, tonePct: 60 }, 'CLENCHED (60%)'],
    [{ isActivelyVoiding: true, dilationPct: 87, tonePct: 60 }, 'DILATING (87%)'],
    [{ tonePct: 41 }, 'STRAINED (41%)'],
    [{ tonePct: 40 }, 'RESTING (40%)'],
  ])('%o → %s', (over, text) => {
    expect(sphincterReadout(hud(over)).text).toBe(text)
  })

  it('turns red on the way to 100 %, where leaks start', () => {
    expect(sphincterReadout(hud({ tonePct: 79 })).tone).toContain('amber')
    expect(sphincterReadout(hud({ tonePct: 80 })).tone).toContain('red')
  })
})

describe('organ status badge and vignette', () => {
  it.each([
    [{ involuntaryVoiding: true }, 'INVOLUNTARY VOID', 0.95],
    [{ isStressLeaking: true, volume: 700 }, 'STRESS LEAK', 0.7],
    [{ volume: 608 }, 'OVERPRESSURE', 0.35],
    [{ volume: 600 }, 'DISTENDED', 0],
    [{ volume: 304 }, 'DISTENDED', 0],
    [{ volume: 300 }, 'NOMINAL', 0],
  ])('%o → %s', (over, badge, vignette) => {
    const status = organStatus(hud(over))
    expect(status.badge).toBe(badge)
    expect(status.vignette).toBe(vignette)
  })

  it('pulses the vignette only on total failure', () => {
    expect(organStatus(hud({ involuntaryVoiding: true })).vignettePulse).toBe(true)
    expect(organStatus(hud({ isStressLeaking: true })).vignettePulse).toBe(false)
  })
})
