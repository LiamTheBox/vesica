// A button on one of the stage's rails: the same size and look on both. `note` replaces its
// label for a while (a countdown); `active` lights it (a tool in use, a view switched on).
export default function RailButton({ icon, label, title = label, note, active = false, ...rest }) {
  return (
    <button
      aria-label={label}
      title={title}
      className={`w-12 min-h-11 flex-shrink-0 rounded-xl flex flex-col items-center justify-center transition active:scale-95 disabled:opacity-45 disabled:active:scale-100 ${active ? 'bg-sky-500/25 text-sky-300 ring-1 ring-sky-400' : 'text-slate-300 hover:bg-slate-800/70'}`}
      {...rest}
    >
      <span className="text-base leading-none" aria-hidden="true">{icon}</span>
      <span className="text-[9px] font-mono mt-0.5">{note ?? label}</span>
    </button>
  )
}
