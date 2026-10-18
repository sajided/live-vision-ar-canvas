import { AnimatePresence, motion } from 'motion/react'

/**
 * Immediate visual response while waiting for the first element: a soft
 * band sweeping over the frozen frame, so it's clear the photo is being read.
 */
export function ScanSweep({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          aria-hidden
        >
          <motion.div
            className="absolute inset-x-0 h-1/4 bg-gradient-to-b from-transparent via-cyan-300/25 to-transparent"
            initial={{ top: '-25%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-x-0 h-px bg-cyan-300/70 shadow-[0_0_12px_2px_rgb(103_232_249/0.6)]"
            initial={{ top: '0%' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, delay: 0.2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
