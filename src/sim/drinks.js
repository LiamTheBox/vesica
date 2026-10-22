// The drinks menu: the original's four shelf drinks (same keys and numbers) and 36 more.
// vol: ml that reach the bladder; rate: ml/s they arrive at once drunk; hyd: how hydrating
// it is (1 = water, pale urine). Caffeine and alcohol are diuretics: they arrive fast and
// hydrate poorly, so a small espresso still sends 120 ml down.
const drink = (name, icon, vol, rate, hyd) => ({ name, icon, vol, rate, hyd })

// The four on the shelf under the bladder, in order.
export const SHELF = ['water', 'coffee', 'soda', 'beer']

export const DRINK_GROUPS = [
  {
    name: 'Water',
    kind: 'water',
    drinks: {
      water: drink('Water', '💧', 180, 8, 1.0),
      sparkling: drink('Sparkling Water', '🫧', 250, 9, 1.0),
      bottle: drink('Big Bottle', '🚰', 500, 10, 1.0),
      cucumber: drink('Cucumber Water', '🥒', 250, 8, 1.0),
      coconut: drink('Coconut Water', '🥥', 300, 8, 0.95),
      sports: drink('Sports Drink', '🏅', 350, 10, 0.9),
    },
  },
  {
    name: 'Coffee & Tea',
    drinks: {
      coffee: drink('Espresso', '☕', 120, 22, 0.3),
      americano: drink('Americano', '☕', 260, 20, 0.4),
      coldBrew: drink('Cold Brew', '🧊', 350, 24, 0.35),
      greenTea: drink('Green Tea', '🍵', 250, 16, 0.6),
      matcha: drink('Matcha Latte', '🍵', 300, 14, 0.55),
      blackTea: drink('Black Tea', '🫖', 250, 18, 0.5),
      mate: drink('Yerba Mate', '🧉', 300, 20, 0.5),
      bubbleTea: drink('Bubble Tea', '🧋', 450, 10, 0.5),
      chamomile: drink('Chamomile', '🌼', 250, 9, 0.9),
    },
  },
  {
    name: 'Soft Drinks',
    drinks: {
      soda: drink('Energy', '⚡', 320, 16, 0.45),
      energyShot: drink('Energy Shot', '🔋', 60, 30, 0.3),
      cola: drink('Cola', '🥤', 330, 15, 0.4),
      bigSoda: drink('Supersize Soda', '🥤', 600, 14, 0.4),
      creamSoda: drink('Cream Soda', '🍨', 330, 14, 0.45),
      lemonade: drink('Lemonade', '🍋', 300, 11, 0.7),
      icedTea: drink('Peach Iced Tea', '🍑', 400, 14, 0.6),
    },
  },
  {
    name: 'Juice & Smoothies',
    drinks: {
      orange: drink('Orange Juice', '🍊', 250, 9, 0.75),
      apple: drink('Apple Juice', '🍏', 250, 9, 0.75),
      cranberry: drink('Cranberry Juice', '🍒', 250, 10, 0.75),
      pineapple: drink('Pineapple Juice', '🍍', 250, 9, 0.75),
      watermelon: drink('Watermelon Juice', '🍉', 350, 10, 0.9),
      tomato: drink('Tomato Juice', '🍅', 250, 7, 0.7),
      smoothie: drink('Berry Smoothie', '🍓', 350, 6, 0.7),
    },
  },
  {
    name: 'Milk & More',
    drinks: {
      milk: drink('Milk', '🥛', 250, 6, 0.8),
      chocolateMilk: drink('Chocolate Milk', '🍫', 300, 6, 0.7),
      milkshake: drink('Milkshake', '🍦', 400, 5, 0.6),
      broth: drink('Bone Broth', '🍲', 300, 7, 0.85),
    },
  },
  {
    name: 'Alcohol',
    kind: 'alcohol',
    drinks: {
      beer: drink('Brew', '🍺', 480, 26, 0.4),
      pitcher: drink('Beer Pitcher', '🍻', 600, 28, 0.35),
      wine: drink('Red Wine', '🍷', 220, 24, 0.35),
      champagne: drink('Champagne', '🥂', 200, 26, 0.35),
      margarita: drink('Margarita', '🍹', 250, 26, 0.35),
      sake: drink('Sake', '🍶', 180, 26, 0.35),
      whisky: drink('Whisky', '🥃', 120, 30, 0.3),
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
