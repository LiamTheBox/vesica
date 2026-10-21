import { expect, test } from '@playwright/test'
import { findOpenCanvasPoint, portState, startApp } from './helpers/app'
import { openOriginal } from './helpers/original'

// Touches on the bladder (ROADMAP M2). Runs on Pixel 7 only (see playwright.config.js).

// Strain is left out: pokes and slaps now add 5 % each (requested; the original's 8 % and 15 %).
const FIELDS = ['sloshVelX', 'sloshVelZ', 'jiggleIntensity']

const resetState = { sphincterToneStrain: 0, sloshVelX: 0, sloshVelZ: 0, jiggleIntensity: 0 }

test.describe('same touch in the original and the port', () => {
  for (const [name, originalCall, portAction] of [
    ['a poke', 'pokeBladder(new THREE.Vector3(1, 0.7, 2), 2.2)', ['pokeAt', { x: 1, y: 0.5, z: 2 }, 2.2]],
    ['a slap', 'slapBladder(new THREE.Vector3(-1.5, 0.2, 1.5), 2.4)', ['slapAt', { x: -1.5, y: 0, z: 1.5 }, 2.4]],
  ]) {
    test(`${name} changes slosh and jiggle identically, and adds 5 % strain`, async ({ page }) => {
      test.skip(!(await openOriginal(page)), 'original needs CDN access')
      // Run synchronously so no frame of physics runs between the touch and the read.
      const original = await page.evaluate(`(() => {
        Object.assign(sim, ${JSON.stringify(resetState)})
        ${originalCall}
        return { ${FIELDS.map((f) => `${f}: sim.${f}`).join(', ')} }
      })()`)

      await startApp(page)
      const port = await page.evaluate(([reset, [action, ...args], fields]) => {
        const v = window.__vesica
        v.setState(reset)
        v.act(action, ...args)
        const s = v.getState()
        return Object.fromEntries([...fields, 'sphincterToneStrain'].map((f) => [f, s[f]]))
      }, [resetState, portAction, FIELDS])

      for (const field of FIELDS) expect(port[field], field).toBeCloseTo(original[field], 9)
      expect(port.sphincterToneStrain).toBeCloseTo(0.05, 9)
    })
  }
})

test.describe('gestures on the bladder', () => {
  let point

  test.beforeEach(async ({ page }) => {
    const box = await startApp(page)
    point = await findOpenCanvasPoint(page, box)
    await page.evaluate(() => {
      window.__vesica.setState({ sphincterToneStrain: 0, urgeWaveTimer: 999 })
      window.__vesica.clearEvents()
    })
  })

  const setMode = (page, mode) => page.evaluate((m) => window.__vesica.setUi({ interactionMode: m }), mode)
  const eventsOf = (page, type) => page.evaluate((t) => window.__vesica.events.filter((e) => e.type === t), type)

  test('a tap in Poke mode pokes with squish force and strains the sphincter', async ({ page }) => {
    await page.touchscreen.tap(point.x, point.y)
    const [poke] = await eventsOf(page, 'poke')
    expect(poke).toMatchObject({ strength: 2.2, touch: true })
    expect((await portState(page)).sphincterToneStrain).toBeCloseTo(0.05, 6)
  })

  test('dragging in Poke mode keeps poking softly', async ({ page }) => {
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    for (let i = 1; i <= 5; i++) await page.mouse.move(point.x + i * 6, point.y)
    await page.mouse.up()
    const pokes = await eventsOf(page, 'poke')
    expect(pokes[0]).toMatchObject({ strength: 2.2, touch: true })
    expect(pokes.slice(1).length).toBeGreaterThanOrEqual(3)
    for (const p of pokes.slice(1)) expect(p).toMatchObject({ strength: 0.7, touch: false })
  })

  test('a tap in Slap mode slaps at 2.0, a fast swipe slaps harder', async ({ page }) => {
    await setMode(page, 'slap')
    await page.touchscreen.tap(point.x, point.y)
    expect((await eventsOf(page, 'slap'))[0]).toMatchObject({ strength: 2.0, haptic: true })
    expect((await portState(page)).sphincterToneStrain).toBeCloseTo(0.05, 6)

    await page.mouse.move(point.x - 40, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 40, point.y, { steps: 2 })
    await page.mouse.up()
    const swipes = (await eventsOf(page, 'slap')).slice(2)
    expect(swipes.length).toBeGreaterThan(0)
    expect(swipes[0].strength).toBeCloseTo(Math.min(3, 40 * 0.14), 6)
  })

  test('squeezing holds, builds with drag, survives leaving the bladder and releases', async ({ page }) => {
    await setMode(page, 'squeeze')
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    expect((await portState(page)).targetSqueezeY).toBe(0.35)
    // Drag far off the bladder: the window keeps tracking, as in the original.
    await page.mouse.move(point.x, point.y + 40, { steps: 4 })
    await page.mouse.move(5, 5, { steps: 4 })
    expect((await portState(page)).targetSqueezeY).toBeGreaterThan(0.35)
    await page.mouse.up()
    expect((await portState(page)).targetSqueezeY).toBe(0)
    expect(await eventsOf(page, 'squeezeRelease')).toHaveLength(1)
  })

  test('orbiting moves the camera and sloshes the fluid', async ({ page }) => {
    await setMode(page, 'orbit')
    const before = await page.evaluate(() => window.__vesica.three().camera.position.toArray())
    await page.evaluate(() => window.__vesica.setState({ sloshVelX: 0, sloshVelZ: 0 }))
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 120, point.y + 20, { steps: 6 })
    await page.mouse.up()
    const after = await page.evaluate(() => window.__vesica.three().camera.position.toArray())
    expect(after).not.toEqual(before)
    const s = await portState(page)
    expect(Math.abs(s.sloshVelX) + Math.abs(s.sloshVelZ)).toBeGreaterThan(0)
  })

  test('the Slap button slaps at 2.4 without the touch vibration', async ({ page }) => {
    await page.getByRole('button', { name: /Slap/ }).click()
    expect((await eventsOf(page, 'slap'))[0]).toMatchObject({ strength: 2.4, haptic: false })
    expect((await portState(page)).sphincterToneStrain).toBeCloseTo(0.05, 6)
  })

  test('cutaway opens the side facing the camera, even from behind', async ({ page }) => {
    await page.locator('button[title*="Cutaway"]').click() // label text is hidden at phone width
    // Orbit the camera behind the bladder, then let a frame re-aim the cut.
    await page.evaluate(() => {
      const { camera, controls } = window.__vesica.three()
      camera.position.set(0, 1.7, -12)
      controls.update()
    })
    await page.waitForTimeout(500)
    const { near, far } = await page.evaluate(() => {
      const { scene } = window.__vesica.three()
      let plane
      scene.traverse((o) => { if (!plane && o.material?.clippingPlanes?.length) plane = o.material.clippingPlanes.at(-1) })
      return { near: plane.distanceToPoint({ x: 0, y: 0.2, z: -2 }), far: plane.distanceToPoint({ x: 0, y: 0.2, z: 2 }) }
    })
    expect(near).toBeLessThan(0) // the half facing the camera is cut away
    expect(far).toBeGreaterThan(0)
  })
})

// Requested after M7: no urine when empty; the gap is muscle wall, not air.
test('the urine grows with the volume held, and an empty bladder holds none', async ({ page }) => {
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await startApp(page)
  await page.evaluate(() => window.__vesica.pause())
  await page.locator('button[title*="Cutaway"]').click() // compiles the cut-face shaders
  const urineAt = async (volume) => {
    await page.evaluate((volume) => window.__vesica.setState({ volume }), volume)
    await page.waitForTimeout(300) // a few frames
    return page.evaluate(() => {
      const { scene } = window.__vesica.three()
      const urine = scene.getObjectByName('urine')
      return { visible: urine.visible, scale: urine.scale.x }
    })
  }

  expect((await urineAt(10)).visible).toBe(false) // what's left after voiding
  const sizes = []
  for (const volume of [20, 120, 375, 750]) {
    const urine = await urineAt(volume)
    expect(urine.visible).toBe(true)
    sizes.push(urine.scale)
  }
  expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  expect(sizes.at(-1)).toBeCloseTo(0.965, 3) // full: just inside the membrane
  expect(errors).toEqual([])
})
