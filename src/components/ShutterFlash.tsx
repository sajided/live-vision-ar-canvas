import { AnimatePresence, motion } from 'motion/react'

/** Brief white flash when a frame is frozen. `flashKey` changes once per capture. */
export function ShutterFlash({ flashKey }: { flashKey: number | null }) {
  return (
    <AnimatePresence>
      {flashKey !== null && (
        <motion.div
          key={flashKey}
          className="pointer-events-none fixed inset-0 z-40 bg-white"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  )
}
