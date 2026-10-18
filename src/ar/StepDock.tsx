import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import type { Size } from '../camera/geometry'
import type { OverlayElementProps } from '../components/overlay/types'
import type { PxPoint } from './project'
import { NO_DOCK, type DockBox } from './dockBox'
import { registry, type CardElement } from './registry'
import type { Point } from './schema'

interface StepDockProps {
  /** Step cards (numbered steps and diagrams) in reveal order. */
  steps: CardElement[]
  /** When each step may appear (seconds), so steps follow the pen drawing. */
  delays: Record<string, number>
  project: (point: Point) => PxPoint
  screen: Size
  onDismissAll: (ids: string[]) => void
  /** Reports the step on screen, so its spot on the photo can be highlighted. */
  onCurrentChange: (id: string | null) => void
  /** Reports the dock's footprint so floating labels and cards stay clear of it. */
  onSize: (box: DockBox) => void
}

const SWIPE_PX = 60


/** Ids whose reveal delay has elapsed. */
function useRevealed(steps: CardElement[], delays: Record<string, number>): Set<string> {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  // Each step is scheduled once, when it arrives; its delay counts from then.
  const scheduled = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    for (const s of steps) {
      if (scheduled.current.has(s.id)) continue
      const reveal = () => setRevealed((prev) => new Set(prev).add(s.id))
      scheduled.current.set(s.id, setTimeout(reveal, (delays[s.id] ?? 0) * 1000))
    }
  }, [steps, delays])
  useEffect(() => {
    const timers = scheduled.current
    return () => timers.forEach(clearTimeout)
  }, [])
  return revealed
}

/**
 * Docked step viewer: numbered steps and diagrams are read one at a time
 * above the controls (beside the photo in landscape) instead of covering the
 * figure. Follows new steps as they arrive unless the user pages back.
 */
export function StepDock({ steps, delays, project, screen, onDismissAll, onCurrentChange, onSize }: StepDockProps) {
  const revealed = useRevealed(steps, delays)
  const shown = steps.filter((s) => revealed.has(s.id))
  const [index, setIndex] = useState(0)
  const [following, setFollowing] = useState(true)
  const [direction, setDirection] = useState(1)
  const ref = useRef<HTMLDivElement>(null)
  const side = screen.width > screen.height

  const last = shown.length - 1
  const current = shown[following ? last : Math.min(index, last)]

  useEffect(() => {
    onCurrentChange(current?.id ?? null)
  }, [current?.id, onCurrentChange])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return onSize(NO_DOCK)
    const report = () => {
      const r = el.getBoundingClientRect()
      onSize({ left: r.left, top: r.top, width: r.width, height: r.height, side })
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [side, onSize, current?.id])

  if (!current) return null
  const position = shown.indexOf(current)

  const go = (to: number) => {
    const next = Math.max(0, Math.min(last, to))
    setDirection(next >= position ? 1 : -1)
    setIndex(next)
    setFollowing(next === last)
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_PX) go(position + 1)
    else if (info.offset.x > SWIPE_PX) go(position - 1)
  }

  const Component = registry[current.type].component as ComponentType<OverlayElementProps<CardElement>>

  return (
    <motion.div
      ref={ref}
      data-testid="step-dock"
      className={`pointer-events-auto fixed z-20 ${
        side
          ? // Below the mute button, only as tall as the current step.
            'top-[calc(max(0.5rem,env(safe-area-inset-top))+2.75rem)] right-3 max-h-[calc(100dvh-max(1.5rem,env(safe-area-inset-bottom))-9rem)] w-[min(320px,42vw)] overflow-hidden'
          : 'inset-x-3 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+5.75rem)] mx-auto max-w-md'
      }`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
    >
      <div className="flex items-center gap-1 pb-1">
        <button
          type="button"
          aria-label="Previous step"
          disabled={position === 0}
          onClick={() => go(position - 1)}
          className="flex size-8 items-center justify-center rounded-full bg-black/30 text-white disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5" aria-label={`Step ${position + 1} of ${shown.length}`}>
          {shown.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              onClick={() => go(i)}
              // Dark ring keeps the dots visible on white paper.
              className={`h-1.5 rounded-full ring-1 ring-black/40 transition-all ${i === position ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next step"
          disabled={position === last}
          onClick={() => go(position + 1)}
          className="flex size-8 items-center justify-center rounded-full bg-black/30 text-white disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Close steps"
          onClick={() => onDismissAll(steps.map((s) => s.id))}
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-black/30 text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={onDragEnd}
          initial={{ opacity: 0, x: 24 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * direction }}
          transition={{ duration: 0.2 }}
          className="touch-pan-y px-1"
        >
          <Component element={current} project={project} screen={screen} delay={0} onDismiss={() => {}} docked />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
