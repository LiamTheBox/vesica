import { describe, expect, it } from 'vitest'
import { BEVERAGE_TYPES, PHYSICS_CONFIGS } from './constants'
import { extractOriginalConst } from '../test/original'

describe('constants match the original game', () => {
  it('beverages', () => {
    expect(BEVERAGE_TYPES).toEqual(extractOriginalConst('BEVERAGE_TYPES'))
  })

  it('physics presets', () => {
    expect(PHYSICS_CONFIGS).toEqual(extractOriginalConst('PHYSICS_CONFIGS'))
  })
})
