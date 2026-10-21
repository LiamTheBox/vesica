import { afterEach, describe, expect, it, vi } from 'vitest'
import { Voice, pickVoice } from './voice'

const DT = 1 / 60

// A voice with no speech engine (as in a browser without voices): lines still show as
// subtitles, paced by their estimated length. `said` lists the categories shown.
function speaker() {
  const voice = new Voice()
  const said = []
  voice.onSubtitle = (text, category) => said.push(category)
  const wait = (seconds) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) voice.update(DT)
  }
  return { voice, said, wait }
}

describe('who gets to speak (A)', () => {
  it('reacts at once, even right after chatter, and cuts the chatter off', () => {
    const { voice, said, wait } = speaker()
    expect(voice.speak('full')).toBe(true)
    wait(0.5)
    expect(voice.speak('poked')).toBe(true)
    expect(said).toEqual(['full', 'poked'])
  })

  it('lets an urgent line cut in over a reaction, but not the other way round', () => {
    const { voice, said, wait } = speaker()
    voice.speak('poked')
    wait(0.2)
    expect(voice.speak('leak')).toBe(true)
    wait(0.2)
    expect(voice.speak('shaken')).toBe(false)
    expect(said).toEqual(['poked', 'leak'])
  })

  it('has a reaction wait for the line being said, then says it if it is still fresh', () => {
    const { voice, said, wait } = speaker()
    voice.speak('poked')
    wait(0.2)
    expect(voice.speak('soothe')).toBe(false)
    wait(voice.busyUntil - voice.clock + DT)
    expect(said).toEqual(['poked', 'soothe'])

    // Too long a wait, and it's dropped.
    const slow = speaker()
    slow.voice.speak('leak')
    slow.wait(0.1)
    slow.voice.busyUntil = slow.voice.clock + 6 // a slow voice still talking
    slow.voice.speak('shaken')
    slow.wait(7)
    expect(slow.said).toEqual(['leak'])
  })

  it('cuts off whatever is being said when it starts to void, and drops the line waiting (bug fix)', () => {
    const { voice, said, wait } = speaker()
    voice.speak('drinkWater')
    wait(0.2)
    voice.speak('poked') // waits for the drink line
    expect(voice.speak('voiding')).toBe(true)
    wait(10)
    expect(said).toEqual(['drinkWater', 'voiding'])
  })

  it("doesn't repeat a reaction straight away", () => {
    const { voice, said, wait } = speaker()
    voice.speak('poked')
    wait(3)
    expect(voice.speak('poked')).toBe(false)
    wait(1.1)
    expect(voice.speak('poked')).toBe(true)
    expect(said).toEqual(['poked', 'poked'])
  })

  it('chats only every `chatGap` seconds, after a quiet spell, and more often when desperate', () => {
    const { voice, said, wait } = speaker()
    voice.chatGap = 30
    const chat = (category, seconds) => {
      for (let t = 0; t < seconds - 1e-9; t += DT) {
        voice.speak(category)
        voice.update(DT)
      }
    }
    chat('distended', 65)
    expect(said.filter((c) => c === 'distended')).toHaveLength(3) // at 0, 30 and 60 s

    // A reaction resets the quiet spell.
    said.length = 0
    wait(29)
    voice.speak('poked')
    chat('distended', 5)
    expect(said).toEqual(['poked'])
    chat('distended', 2)
    expect(said).toEqual(['poked', 'distended'])

    said.length = 0
    chat('critical', 61)
    expect(said).toHaveLength(4) // every 15 s
  })
})

describe('with a speech engine (A)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('cancels the line being said when a more important one cuts in, and frees up when it ends', () => {
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(text) { this.text = text } })
    const synth = { speaking: false, spoken: [], cancel: vi.fn(), speak(u) { this.spoken.push(u) }, getVoices: () => [] }
    const { voice, wait } = speaker()
    voice.synth = synth

    voice.speak('distended')
    synth.speaking = true
    wait(0.3)
    voice.speak('poked')
    expect(synth.cancel).toHaveBeenCalledTimes(1)
    expect(synth.spoken).toHaveLength(2)

    // The engine says when the line ends; then even another reaction may speak at once.
    synth.speaking = false
    synth.spoken[1].onend()
    expect(voice.speak('soothe')).toBe(true)
    expect(synth.cancel).toHaveBeenCalledTimes(1)
  })
})

describe('which voice it speaks with', () => {
  const v = (name, lang, localService) => ({ name, lang, localService })
  const installed = [
    v('Google US English', 'en-US', false),
    v('Daniel', 'en-GB', true),
    v('Samantha', 'en-US', true),
    v('Amélie', 'fr-CA', true),
  ]

  it('prefers a voice on the device, so it still talks offline', () => {
    expect(pickVoice(installed).name).toBe('Samantha')
    expect(pickVoice([v('Google US English', 'en-US', false), v('Daniel', 'en-GB', true)]).name).toBe('Daniel')
    expect(pickVoice([v('Google US English', 'en-US', false)]).name).toBe('Google US English')
    expect(pickVoice([])).toBeNull()
  })

  it("speaks with the player's choice while it's installed", () => {
    expect(pickVoice(installed, 'Daniel').name).toBe('Daniel')
    expect(pickVoice(installed, 'Uninstalled').name).toBe('Samantha')
  })

  it('lists the English voices, those on the device first', () => {
    const voice = new Voice()
    voice.synth = { getVoices: () => installed }
    expect(voice.voices().map((x) => x.name)).toEqual(['Daniel', 'Samantha', 'Google US English'])
  })
})
