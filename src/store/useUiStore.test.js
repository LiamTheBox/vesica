import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './useUiStore'

describe('default settings', () => {
  it("keep the bladder's lines off the screen (requested), and its voice on", () => {
    expect(DEFAULT_SETTINGS.subtitles).toBe(false)
    expect(DEFAULT_SETTINGS.voiceEnabled).toBe(true)
  })
})
