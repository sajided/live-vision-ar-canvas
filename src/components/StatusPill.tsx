import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { Toast } from '../hooks/useToast'

interface StatusPillProps {
  loading: boolean
  toast: Toast | null
}

/** Compact top-of-screen status: a toast takes precedence over the loading indicator. */
export function StatusPill({ loading, toast }: StatusPillProps) {
  const key = toast ? `${toast.tone}:${toast.text}` : loading ? 'loading' : null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      <AnimatePresence mode="wait">
        {key && (
          <motion.div
            key={key}
            role={toast?.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex max-w-md items-center gap-3 rounded-2xl px-4 py-2 text-center text-sm shadow-lg backdrop-blur ${
              toast?.tone === 'error' ? 'bg-red-600/90' : 'bg-black/60'
            } ${toast?.action ? 'pointer-events-auto' : ''}`}
          >
            {toast?.text}
            {toast?.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black active:scale-95"
              >
                {toast.action.label}
              </button>
            )}
            {!toast && (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reading the problem…
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
