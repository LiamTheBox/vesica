import { useUiStore } from '../../../store/useUiStore'
import { t } from '../../../i18n'

const NAV = [
  { id: 'sim', icon: '🫁' },
  { id: 'telemetry', icon: '📈' },
  { id: 'challenges', icon: '🏆' },
  { id: 'stories', icon: '📖' },
  { id: 'settings', icon: '⚙️' },
]

export default function BottomNav() {
  const currentTab = useUiStore((s) => s.currentTab)
  const setTab = useUiStore((s) => s.setTab)

  return (
    <nav className="max-w-md w-full mx-auto pointer-events-auto glass-hud px-2 py-1 rounded-2xl flex items-center justify-around text-[10px] font-mono">
      {NAV.map(item => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          aria-current={currentTab === item.id ? 'page' : undefined}
          className={`min-w-11 min-h-11 flex flex-col items-center justify-center gap-0.5 transition ${
            currentTab === item.id 
              ? 'text-amber-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span>{t(`nav.${item.id}`)}</span>
        </button>
      ))}
    </nav>
  )
}
