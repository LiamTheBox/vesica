import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioManager } from './AudioManager'

const DT = 1 / 60

// A voice with no speech engine (as in a browser without voices): lines still show as
// subtitles, paced by their estimated length. `said` lists the categories shown.
function voice() {
  const audio = new AudioManager()
  const said = []
  audio.onSubtitle = (text, category) => said.push(category)
  const wait = (seconds) => {
    for (let t = 0; t < seconds - 1e-9; t += DT) audio.update(DT)
  }
  return { audio, said, wait }
}

describe('who gets to speak (A)', () => {
  it('reacts at once, even right after chatter, and cuts the chatter off', () => {
    const { audio, said, wait } = voice()
    expect(audio.speak('full')).toBe(true)
    wait(0.5)
    expect(audio.speak('poked')).toBe(true)
    expect(said).toEqual(['full', 'poked'])
  })

  it('lets an urgent line cut in over a reaction, but not the other way round', () => {
    const { audio, said, wait } = voice()
    audio.speak('poked')
    wait(0.2)
    expect(audio.speak('leak')).toBe(true)
    wait(0.2)
    expect(audio.speak('shaken')).toBe(false)
    expect(said).toEqual(['poked', 'leak'])
  })

  it('has a reaction wait for the line being said, then says it if it is still fresh', () => {
    const { audio, said, wait } = voice()
    audio.speak('poked')
    wait(0.2)
    expect(audio.speak('soothe')).toBe(false)
    wait(audio.busyUntil - audio.clock + DT)
    expect(said).toEqual(['poked', 'soothe'])

    // Too long a wait, and it's dropped.
    const slow = voice()
    slow.audio.speak('leak')
    slow.wait(0.1)
    slow.audio.busyUntil = slow.audio.clock + 6 // a slow voice still talking
    slow.audio.speak('shaken')
    slow.wait(7)
    expect(slow.said).toEqual(['leak'])
  })

  it("doesn't repeat a reaction straight away", () => {
    const { audio, said, wait } = voice()
    audio.speak('poked')
    wait(3)
    expect(audio.speak('poked')).toBe(false)
    wait(1.1)
    expect(audio.speak('poked')).toBe(true)
    expect(said).toEqual(['poked', 'poked'])
  })

  it('chats only every `chatGap` seconds, after a quiet spell, and more often when desperate', () => {
    const { audio, said, wait } = voice()
    audio.chatGap = 30
    const chat = (category, seconds) => {
      for (let t = 0; t < seconds - 1e-9; t += DT) {
        audio.speak(category)
        audio.update(DT)
      }
    }
    chat('distended', 65)
    expect(said.filter((c) => c === 'distended')).toHaveLength(3) // at 0, 30 and 60 s

    // A reaction resets the quiet spell.
    said.length = 0
    wait(29)
    audio.speak('poked')
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
    const { audio, wait } = voice()
    audio.synth = synth

    audio.speak('distended')
    synth.speaking = true
    wait(0.3)
    audio.speak('poked')
    expect(synth.cancel).toHaveBeenCalledTimes(1)
    expect(synth.spoken).toHaveLength(2)

    // The engine says when the line ends; then even another reaction may speak at once.
    synth.speaking = false
    synth.spoken[1].onend()
    expect(audio.speak('soothe')).toBe(true)
    expect(synth.cancel).toHaveBeenCalledTimes(1)
  })
})
