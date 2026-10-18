import { Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { isMuted, setMuted } from '../feedback/feedback'

export function MuteToggle() {
  const [muted, setState] = useState(isMuted)
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted)
        setState(!muted)
      }}
      aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'}
      aria-pressed={muted}
      className="fixed right-2 z-50 flex size-8 items-center justify-center rounded-full bg-black/40 text-white/80"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
