import { useEffect, useState } from 'react'
import { useUiStore } from '../../store/useUiStore'
import { STICKERS } from '../../challenges/stickers'
import { t } from '../../i18n'

const BY_ID = Object.fromEntries(STICKERS.map((sticker) => [sticker.id, sticker]))

// A sticker just earned (A12), shown for 3 s over the top of the screen in every mode.
export default function StickerToast() {
  const toast = useUiStore((s) => s.stickerToast)
  const [expiredId, setExpiredId] = useState(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setExpiredId(toast.id), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast || toast.id === expiredId) return null
  const stickers = toast.ids.map((id) => BY_ID[id]).filter(Boolean)
  return (
    <div role="status" className="absolute inset-x-0 top-20 z-20 flex justify-center px-4 pointer-events-none">
      <div className="glass-hud bubble-animate px-4 py-2 rounded-2xl border border-amber-400/60 flex items-center gap-2 shadow-2xl">
        <span className="text-2xl" aria-hidden="true">{stickers.map((s) => s.icon).join(' ')}</span>
        <span>
          <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300">{t('stickers.new')}</span>
          <span className="block text-xs font-bold text-slate-100">{stickers.map((s) => t(`sticker.${s.id}`)).join(', ')}</span>
        </span>
      </div>
    </div>
  )
}
