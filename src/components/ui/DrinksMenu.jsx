import { act } from '../../sim/engine'
import { ingestBeverage } from '../../sim/sim'
import { DIURETIC_HYD, DRINK_COUNT, DRINK_GROUPS, hasAlcohol, hasCaffeine } from '../../sim/drinks'
import { useUiStore } from '../../store/useUiStore'
import Sheet from './Sheet'

// What a drink does besides fill the bladder, if anything.
const effectOf = (key, d) => (hasAlcohol(key) ? '🍺 tires the clench' : hasCaffeine(key) ? '☕ urges sooner' : d.hyd <= DIURETIC_HYD ? 'diuretic' : null)

// Every drink, by group, opened from the drinks shelf. The sheet scrolls when they don't
// all fit on the screen; choosing one drinks it and closes the menu.
export default function DrinksMenu() {
  const setTab = useUiStore((s) => s.setTab)
  const close = () => setTab('sim')
  const choose = (key) => {
    act(ingestBeverage, key)
    close()
  }

  return (
    <Sheet title="Drinks Menu" subtitle={`${DRINK_COUNT} drinks · tap one to drink it`} titleTone="text-fuchsia-300" onClose={close}>
      {DRINK_GROUPS.map((group) => (
        <section key={group.name} className="flex flex-col gap-2">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">{group.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(group.drinks).map(([key, d]) => (
              <button
                key={key}
                onClick={() => choose(key)}
                className="min-h-14 px-2.5 py-2 rounded-xl bg-slate-800/70 hover:bg-cyan-950/70 active:scale-95 border border-slate-700 hover:border-cyan-500/80 flex items-center gap-2 text-left transition"
              >
                <span className="text-xl flex-shrink-0" aria-hidden="true">{d.icon}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight text-slate-100">{d.name}</span>
                  {/* How much reaches the bladder, and how long it takes to arrive. */}
                  <span className="block text-[10px] font-mono text-cyan-400 whitespace-nowrap">+{d.vol} ml · {Math.round(d.vol / d.rate)} s</span>
                  {effectOf(key, d) && <span className="block text-[10px] font-mono text-amber-400 whitespace-nowrap">{effectOf(key, d)}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  )
}
