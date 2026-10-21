import { BEVERAGE_TYPES } from '../physics/constants'

// The drinks menu: the original's four shelf drinks (same keys and numbers) and 36 more.
// vol: ml that reach the bladder; rate: ml/s they arrive at once drunk; hyd: how hydrating
// it is (1 = water, pale urine). Caffeine and alcohol are diuretics: they arrive fast and
// hydrate poorly, so a small espresso still sends 120 ml down.
const drink = (name, icon, vol, rate, hyd) => ({ name, icon, vol, rate, hyd })
const shelf = (key, name, icon) => ({ name, icon, ...BEVERAGE_TYPES[key] })

export const DRINK_GROUPS = [
  {
    name: 'Water',
    drinks: {
      water: shelf('water', 'Water', '💧'),
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
      coffee: shelf('coffee', 'Espresso', '☕'),
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
      soda: shelf('soda', 'Energy', '⚡'),
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
    drinks: {
      beer: shelf('beer', 'Brew', '🍺'),
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
