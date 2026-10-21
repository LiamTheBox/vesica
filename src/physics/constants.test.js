import { describe, expect, it } from 'vitest'
import { PHYSICS_CONFIGS } from './constants'
import { extractOriginalConst } from '../test/original'

describe('constants match the original game', () => {
  it('physics presets', () => {
    expect(PHYSICS_CONFIGS).toEqual(extractOriginalConst('PHYSICS_CONFIGS'))
  })
})
