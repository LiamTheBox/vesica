// The drinks menu: the original's four shelf drinks (same keys and numbers) and 36 more.
// vol: ml that reach the bladder; rate: ml/s they arrive at once drunk; hyd: how hydrating
// it is (1 = water, pale urine). Caffeine and alcohol are diuretics: they arrive fast and
// hydrate poorly, so a small espresso still sends 120 ml down. Their names are i18n's
// drink.<key>, and the groups' drinkGroup.<id>.
const drink = (icon, vol, rate, hyd) => ({ icon, vol, rate, hyd })

// The four on the shelf under the bladder, in order.
export const SHELF = ['water', 'coffee', 'soda', 'beer']

export const DRINK_GROUPS = [
  {
    id: 'water',
    kind: 'water',
    drinks: {
      water: drink('💧', 180, 8, 1.0),
      sparkling: drink('🫧', 250, 9, 1.0),
      bottle: drink('🚰', 500, 10, 1.0),
      cucumber: drink('🥒', 250, 8, 1.0),
      coconut: drink('🥥', 300, 8, 0.95),
      sports: drink('🏅', 350, 10, 0.9),
    },
  },
  {
    id: 'coffeeTea',
    drinks: {
      coffee: drink('☕', 120, 22, 0.3),
      americano: drink('☕', 260, 20, 0.4),
      coldBrew: drink('🧊', 350, 24, 0.35),
      greenTea: drink('🍵', 250, 16, 0.6),
      matcha: drink('🍵', 300, 14, 0.55),
      blackTea: drink('🫖', 250, 18, 0.5),
      mate: drink('🧉', 300, 20, 0.5),
      bubbleTea: drink('🧋', 450, 10, 0.5),
      chamomile: drink('🌼', 250, 9, 0.9),
    },
  },
  {
    id: 'soft',
    drinks: {
      soda: drink('⚡', 320, 16, 0.45),
      energyShot: drink('🔋', 60, 30, 0.3),
      cola: drink('🥤', 330, 15, 0.4),
      bigSoda: drink('🥤', 600, 14, 0.4),
      creamSoda: drink('🍨', 330, 14, 0.45),
      lemonade: drink('🍋', 300, 11, 0.7),
      icedTea: drink('🍑', 400, 14, 0.6),
    },
  },
  {
    id: 'juice',
    drinks: {
      orange: drink('🍊', 250, 9, 0.75),
      apple: drink('🍏', 250, 9, 0.75),
      cranberry: drink('🍒', 250, 10, 0.75),
      pineapple: drink('🍍', 250, 9, 0.75),
      watermelon: drink('🍉', 350, 10, 0.9),
      tomato: drink('🍅', 250, 7, 0.7),
      smoothie: drink('🍓', 350, 6, 0.7),
    },
  },
  {
    id: 'milk',
    drinks: {
      milk: drink('🥛', 250, 6, 0.8),
      chocolateMilk: drink('🍫', 300, 6, 0.7),
      milkshake: drink('🍦', 400, 5, 0.6),
      broth: drink('🍲', 300, 7, 0.85),
    },
  },
  {
    id: 'alcohol',
    kind: 'alcohol',
    drinks: {
      beer: drink('🍺', 480, 26, 0.4),
      pitcher: drink('🍻', 600, 28, 0.35),
      wine: drink('🍷', 220, 24, 0.35),
      champagne: drink('🥂', 200, 26, 0.35),
      margarita: drink('🍹', 250, 26, 0.35),
      sake: drink('🍶', 180, 26, 0.35),
      whisky: drink('🥃', 120, 30, 0.3),
    },
  },
]

// Every drink by key, in menu order.
export const DRINKS = Object.fromEntries(DRINK_GROUPS.flatMap((group) => Object.entries(group.drinks)))
export const DRINK_COUNT = Object.keys(DRINKS).length
// Shown as a diuretic on the menu: hydrates no better than this.
export const DIURETIC_HYD = 0.4

// What the bladder makes of a drink, for what it says: alcohol, then a big one (a lot at
// once, whatever it is), then water, caffeine or anything else.
export const BIG_DRINK = 450
const CAFFEINE = new Set(['coffee', 'americano', 'coldBrew', 'greenTea', 'matcha', 'blackTea', 'mate', 'bubbleTea', 'soda', 'energyShot', 'cola', 'bigSoda'])
const KINDS = Object.fromEntries(DRINK_GROUPS.flatMap((group) => Object.keys(group.drinks).map((key) => [key, group.kind])))
export function drinkKind(key) {
  if (KINDS[key] === 'alcohol') return 'alcohol'
  if (DRINKS[key].vol >= BIG_DRINK) return 'big'
  return KINDS[key] ?? (CAFFEINE.has(key) ? 'caffeine' : 'other')
}

export const hasCaffeine = (key) => CAFFEINE.has(key)
export const hasAlcohol = (key) => KINDS[key] === 'alcohol'

// What the arcade serves as the levels go up (A10): hydrating drinks first, then caffeine
// and sweet ones, then alcohol and the big ones. Each tier adds to the one before.
const gentle = (key) => !hasCaffeine(key) && !hasAlcohol(key) && DRINKS[key].hyd >= 0.7 && DRINKS[key].vol <= 350
const strong = (key) => hasAlcohol(key) || DRINKS[key].vol >= BIG_DRINK
export const SERVED_TIERS = [
  Object.keys(DRINKS).filter(gentle),
  Object.keys(DRINKS).filter((key) => !strong(key)),
  Object.keys(DRINKS),
]
