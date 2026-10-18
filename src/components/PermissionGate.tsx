import { CameraOff, Loader2, RotateCcw } from 'lucide-react'
import type { CameraStatus } from '../camera/useCameraStream'

interface PermissionGateProps {
  status: CameraStatus
  error: string | null
  onRetry: () => void
}

export function PermissionGate({ status, error, onRetry }: PermissionGateProps) {
  if (status === 'live') return null

  if (status === 'idle' || status === 'requesting') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 text-white/80">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">{status === 'requesting' ? 'Waiting for camera access…' : 'Starting camera…'}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <CameraOff className="size-10 text-white/70" />
        <p className="text-base font-medium">{error ?? 'Camera unavailable.'}</p>
        {status === 'denied' && (
          <p className="text-sm text-white/60">
            Allow camera access in your browser's site settings (the icon next to the address bar), then try
            again.
          </p>
        )}
        {status !== 'unsupported' && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black active:scale-95"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
