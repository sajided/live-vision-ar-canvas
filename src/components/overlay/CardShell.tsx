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
  /** Inside the step dock: static layout, no own dismiss button (the dock has one). */
  docked?: boolean
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
  docked = false,
}: CardShellProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Measure before paint so the renderer can re-layout without a visible jump.
  useLayoutEffect(() => {
    if (ref.current) onMeasure?.(id, ref.current.offsetHeight)
  })

  if (docked) {
    return (
      <div role="note" data-overlay="card" className={`text-white ${HALO}`}>
        <CardTitle stepIndex={stepIndex} title={title} />
        {children}
      </div>
    )
  }

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
      <CardTitle stepIndex={stepIndex} title={title} />
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

function CardTitle({ stepIndex, title }: { stepIndex?: number; title?: ReactNode }) {
  if (title === undefined && stepIndex === undefined) return null
  return (
    <div className="flex min-h-8 items-center gap-2.5 pr-8">
      {stepIndex !== undefined && (
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black shadow-md [text-shadow:none] ${RAINBOW_BG[(stepIndex - 1) % RAINBOW_BG.length]}`}
        >
          {stepIndex}
        </span>
      )}
      {title !== undefined && <h2 className="text-[19px] leading-snug font-bold">{title}</h2>}
    </div>
  )
}
