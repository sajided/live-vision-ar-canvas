import { Volume2, VolumeX } from 'lucide-react'

interface MuteToggleProps {
  muted: boolean
  onChange: (muted: boolean) => void
}

/** Turns the tutor voice and sound cues on or off. */
export function MuteToggle({ muted, onChange }: MuteToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!muted)}
      aria-label={muted ? 'Turn tutor voice on' : 'Turn tutor voice off'}
      aria-pressed={muted}
      className="fixed right-2 z-50 flex size-8 items-center justify-center rounded-full bg-black/40 text-white/80"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
