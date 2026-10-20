import { useSimStore } from '../../../store/useSimStore'

export default function BottomNav() {
  const currentTab = useSimStore(s => s.currentTab)
  const setTab = useSimStore.getState().setTab

  const navItems = [
    { id: 'sim', icon: '🫁', label: 'Sim' },
    { id: 'telemetry', icon: '📈', label: 'Telemetry' },
    { id: 'challenges', icon: '🏆', label: 'Challenges' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ]

  return (
    <nav className="max-w-md w-full mx-auto pointer-events-auto glass-hud px-4 py-1.5 rounded-2xl flex items-center justify-around text-[10px] font-mono mt-2">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className={`flex flex-col items-center gap-0.5 transition ${
            currentTab === item.id 
              ? 'text-amber-400 font-bold' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-base">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
