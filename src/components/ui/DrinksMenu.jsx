import { useLayoutEffect, useRef, useState } from 'react'
import { act } from '../../sim/engine'
import { ingestBeverage } from '../../sim/sim'
import { DRINK_COUNT, DRINK_GROUPS, hasAlcohol, hasCaffeine } from '../../sim/drinks'
import { useUiStore } from '../../store/useUiStore'
import { t } from '../../i18n'
import { fitTiles } from './fitTiles'
import Sheet from './Sheet'

const GAP = 6
// Each group's tile, and its dot in the key.
const TONES = {
  water: { tile: 'bg-cyan-950/60 border-cyan-700/70 hover:border-cyan-300', ml: 'text-cyan-300', dot: 'bg-cyan-400' },
  coffeeTea: { tile: 'bg-amber-950/60 border-amber-700/70 hover:border-amber-300', ml: 'text-amber-300', dot: 'bg-amber-400' },
  soft: { tile: 'bg-rose-950/60 border-rose-700/70 hover:border-rose-300', ml: 'text-rose-300', dot: 'bg-rose-400' },
  juice: { tile: 'bg-lime-950/60 border-lime-700/70 hover:border-lime-300', ml: 'text-lime-300', dot: 'bg-lime-400' },
  milk: { tile: 'bg-slate-800/80 border-slate-500/70 hover:border-slate-200', ml: 'text-slate-200', dot: 'bg-slate-300' },
  alcohol: { tile: 'bg-violet-950/60 border-violet-700/70 hover:border-violet-300', ml: 'text-violet-300', dot: 'bg-violet-400' },
}

// What a drink does besides fill the bladder, if anything.
const effectOf = (key) => (hasAlcohol(key) ? { icon: '🍺', text: t('drinks.alcohol') } : hasCaffeine(key) ? { icon: '☕', text: t('drinks.caffeine') } : null)

// The tile size and columns that fit every drink in the room left in the sheet, measured
// from where the grid starts, and again whenever the screen changes.
function useFit(ref) {
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    const grid = ref.current
    const panel = grid.closest('[role="dialog"]')
    const screen = panel.parentElement
    const measure = () => {
      const screenStyle = getComputedStyle(screen)
      const panelStyle = getComputedStyle(panel)
      const room = screen.clientHeight - parseFloat(screenStyle.paddingTop) - parseFloat(screenStyle.paddingBottom)
      const tallest = Math.min(room, parseFloat(panelStyle.maxHeight) || Infinity)
      const above = grid.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop
      const width = panel.clientWidth - parseFloat(panelStyle.paddingLeft) - parseFloat(panelStyle.paddingRight)
      setFit(fitTiles(DRINK_COUNT, width, tallest - above - parseFloat(panelStyle.paddingBottom), GAP))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(screen)
    return () => observer.disconnect()
  }, [ref])
  return fit
}

function DrinkTile({ drinkKey, drink, tone, size, onChoose }) {
  const name = t(`drink.${drinkKey}`)
  const effect = effectOf(drinkKey)
  const seconds = Math.round(drink.vol / drink.rate)
  const label = t('drinks.label', { name, ml: drink.vol, s: seconds }) + (effect ? `, ${effect.text}` : '')
  return (
    <button
      onClick={() => onChoose(drinkKey)}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`relative grid grid-rows-[auto_1fr_auto] justify-items-center p-[calc(var(--tile)*0.05)] rounded-xl border active:scale-95 transition ${tone.tile}`}
    >
      <span aria-hidden="true" className="text-[calc(var(--tile)*0.33)] leading-none">{drink.icon}</span>
      <span className="self-center w-full text-center font-bold leading-[1.1] text-slate-100 line-clamp-2 text-[clamp(8.5px,calc(var(--tile)*0.135),15px)]">{name}</span>
      <span className={`font-mono leading-none whitespace-nowrap text-[clamp(8px,calc(var(--tile)*0.125),14px)] ${tone.ml}`}>{t('drinks.ml', { ml: drink.vol })}</span>
      {effect && <span aria-hidden="true" className="absolute top-[3%] right-[5%] leading-none text-[calc(var(--tile)*0.17)]">{effect.icon}</span>}
    </button>
  )
}

// Every drink, as a block of same-sized squares that fits the screen (requested), each
// group in its colour. Choosing one drinks it and closes the menu.
export default function DrinksMenu() {
  const setTab = useUiStore((s) => s.setTab)
  const close = () => setTab('sim')
  const choose = (key) => {
    act(ingestBeverage, key)
    close()
  }
  const gridRef = useRef(null)
  const fit = useFit(gridRef)

  return (
    <Sheet title={t('drinks.title')} subtitle={t('drinks.subtitle', { n: DRINK_COUNT })} titleTone="text-fuchsia-300" width="max-w-5xl" fullHeight onClose={close}>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] leading-tight font-mono text-slate-400">
        {DRINK_GROUPS.map((group) => (
          <span key={group.id} className="flex items-center gap-1 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${TONES[group.id].dot}`} aria-hidden="true" />
            {t(`drinkGroup.${group.id}`)}
          </span>
        ))}
        <span className="whitespace-nowrap">{t('drinks.caffeine')}</span>
        <span className="whitespace-nowrap">{t('drinks.alcohol')}</span>
      </div>
      <div
        ref={gridRef}
        className="grid justify-center flex-shrink-0"
        style={fit ? { gridTemplateColumns: `repeat(${fit.columns}, ${fit.size}px)`, gap: GAP, '--tile': `${fit.size}px` } : undefined}
      >
        {fit && DRINK_GROUPS.map((group) => (
          <section key={group.id} aria-label={t(`drinkGroup.${group.id}`)} className="contents">
            {Object.entries(group.drinks).map(([key, drink]) => (
              <DrinkTile key={key} drinkKey={key} drink={drink} tone={TONES[group.id]} size={fit.size} onChoose={choose} />
            ))}
          </section>
        ))}
      </div>
    </Sheet>
  )
}
