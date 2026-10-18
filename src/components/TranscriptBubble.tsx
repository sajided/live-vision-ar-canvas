import { AnimatePresence, motion } from 'motion/react'

/** Live speech transcript shown while the mic is held. */
export function TranscriptBubble({ listening, transcript }: { listening: boolean; transcript: string }) {
  return (
    <AnimatePresence>
      {listening && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="pointer-events-none fixed inset-x-4 z-30 mx-auto max-w-md rounded-2xl bg-black/65 px-4 py-3 text-center text-base backdrop-blur-md"
          style={{ bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 6.5rem)' }}
          aria-live="polite"
        >
          {transcript || <span className="text-white/60">Listening…</span>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
