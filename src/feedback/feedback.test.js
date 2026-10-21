import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioManager, audio } from '../audio/AudioManager'
import { voice } from '../audio/voice'
import { sim } from '../sim/engine'
import { useUiStore } from '../store/useUiStore'
import { onEvent } from './feedback'

// The wiring from a simulation event to its sound, the mood and the line said. The sound
// engine is stubbed (no Web Audio in Node); the voice runs for real, without speech.
describe('what an event sounds like and what it says (C14)', () => {
  beforeEach(() => {
    for (const name of Object.getOwnPropertyNames(AudioManager.prototype)) {
      if (name !== 'constructor') vi.spyOn(audio, name).mockImplementation(() => null)
    }
    vi.spyOn(voice, 'speak')
    sim.volume = 300
    useUiStore.setState({ mood: 'calm' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('gulps a drink down and says what it thinks of it', () => {
    onEvent({ type: 'ingest', beverage: 'coffee' })
    expect(audio.playIngest).toHaveBeenCalledOnce()
    expect(voice.speak).toHaveBeenCalledWith('drinkCaffeine')
  })

  it('shivers as a warned urge nears, and warns of it', () => {
    onEvent({ type: 'urgeWarning' })
    expect(audio.playCue).toHaveBeenCalledWith('warning')
    expect(audio.playShiver).toHaveBeenCalledOnce()
    expect(voice.speak).toHaveBeenCalledWith('urgeIncoming')
  })

  it('sighs when a clenched-down urge passes (A2)', () => {
    onEvent({ type: 'urgeEnd', suppressed: true })
    expect(audio.stopUrgeRumble).toHaveBeenCalledOnce()
    expect(audio.playExhale).toHaveBeenCalledWith()
    expect(voice.speak).toHaveBeenCalledWith('urgePassed')
  })

  it('boings on a perfect clench and flashes the score line', () => {
    onEvent({ type: 'arcadePoints', reason: 'perfect', points: 50, combo: 2 })
    expect(audio.playCue).toHaveBeenCalledWith('perfect')
    expect(audio.playBoing).toHaveBeenCalledOnce()
    expect(useUiStore.getState().arcadeToast).toMatchObject({ text: 'PERFECT ×2 +50', tone: 'good' })
    expect(voice.speak).toHaveBeenCalledWith('proud')
  })

  it('huffs at a poke once annoyed, and runs out of patience with a run of them', () => {
    for (let i = 0; i < 4; i++) onEvent({ type: 'poke', touch: true })
    expect(audio.playSquish).toHaveBeenCalledTimes(4)
    expect(audio.playExhale).not.toHaveBeenCalled()
    expect(voice.speak).toHaveBeenLastCalledWith('annoyed')

    useUiStore.setState({ mood: 'annoyed' }) // as the next frame's mood would be
    onEvent({ type: 'poke', touch: true })
    expect(audio.playExhale).toHaveBeenCalledWith(true)
  })
})
