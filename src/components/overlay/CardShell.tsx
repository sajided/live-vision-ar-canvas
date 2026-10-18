import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Rect } from '../../ar/layout'
import { HALO, RAINBOW_BG } from './colors'

interface CardShellProps {
  id: string
  delay: number
  placement?: Rect
  onMeasure?: (id: string, height: number) => void
  onDismiss: (id: string) => void
  dismissLabel: string
  stepIndex?: number
  title?: ReactNode
  children: ReactNode
}

/** Frosted, dismissible card positioned by the renderer's collision-aware layout. */
export function CardShell({
  id,
  delay,
  placement,
  onMeasure,
  onDismiss,
  dismissLabel,
  stepIndex,
  title,
  children,
}: CardShellProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Measure before paint so the renderer can re-layout without a visible jump.
  useLayoutEffect(() => {
    if (ref.current) onMeasure?.(id, ref.current.offsetHeight)
  })

  if (!placement) return null

  return (
    <motion.div
      ref={ref}
      role="note"
      data-overlay="card"
      className={`pointer-events-auto absolute p-3.5 text-white ${HALO}`}
      style={{ left: placement.left, top: placement.top, width: placement.width }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
    >
      {(title !== undefined || stepIndex !== undefined) && (
        <div className="flex min-h-6 items-center gap-2 pr-7">
          {stepIndex !== undefined && (
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black shadow-md [text-shadow:none] ${RAINBOW_BG[(stepIndex - 1) % RAINBOW_BG.length]}`}
            >
              {stepIndex}
            </span>
          )}
          {title !== undefined && <h2 className="text-[15px] leading-snug font-bold">{title}</h2>}
        </div>
      )}
      {children}
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={() => onDismiss(id)}
        className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-black/30 text-white active:bg-black/50"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  )
}
