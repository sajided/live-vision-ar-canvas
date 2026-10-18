import { AnimatePresence, motion } from 'motion/react'

/** What the tutor is saying, for people with sound off or who prefer reading along. */
export function Subtitle({ text }: { text: string | null }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-12"
      style={{ top: 'calc(max(1rem, env(safe-area-inset-top)) + 3rem)' }}
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="max-w-xl rounded-xl bg-black/55 px-3 py-1.5 text-center text-[15px] leading-snug font-medium text-white backdrop-blur-sm"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
