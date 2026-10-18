import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useState, type ComponentType } from 'react'
import type { Size } from '../camera/geometry'
import { OverlayRoot } from '../components/OverlayRoot'
import { useKatexReady } from '../components/math/katexLoader'
import type { OverlayElementProps } from '../components/overlay/types'
import type { CapturedFrame } from '../types/frame'
import { beaconLabelId, estimateTextWidth, layoutLabels, vertexLabelId, type LabelRequest } from './labels'
import { cardWidth, layoutCards, nearestPoint, squareAround, type Rect, type Segment } from './layout'
import { frameToScreen, type PxPoint } from './project'
import { isCard, isStep, registry } from './registry'
import { NO_DOCK, type DockBox } from './dockBox'
import { StepDock } from './StepDock'
import type { ARElement, Point } from './schema'

const CARD_OFFSET = 20
const CARD_HEIGHT_ESTIMATE = 130
// Keeps cards clear of the status pill and the control bar.
const CARD_INSETS = { top: 64, right: 12, bottom: 128, left: 12 }
const CIRCLE_CHORDS = 24
// Labels may go closer to the edges than cards, but never under the control bar.
const LABEL_INSETS = { top: 12, right: 6, bottom: 124, left: 6 }
// Draw a leader line when a card had to move this far from its anchor.
const LEADER_MIN_DISTANCE = CARD_OFFSET * 1.5

interface OverlayRendererProps {
  /** Every element of the response, so layout stays stable as items are dismissed. */
  elements: ARElement[]
  /** The subset still on screen. */
  visible: ARElement[]
  /** Entry delay in seconds per element id. */
  delays: Record<string, number>
  frame: CapturedFrame
  screen: Size
  onDismiss: (id: string) => void
}

/** Rough visible text of a LaTeX string, for width estimates. */
const latexText = (latex: string) => latex.replace(/\\[a-zA-Z]+/g, 'x').replace(/[{}^_\\ ]/g, '')

interface SceneGeometry {
  segments: Segment[]
  dots: Rect[]
  labels: LabelRequest[]
}

/** Screen-space lines, dots and label requests for everything drawn on the photo. */
function sceneGeometry(elements: ARElement[], project: (p: Point) => PxPoint): SceneGeometry {
  const segments: Segment[] = []
  const dots: Rect[] = []
  const labels: LabelRequest[] = []
  for (const el of elements) {
    if (el.type === 'ConnectorLine') {
      segments.push({ from: project(el.from), to: project(el.to) })
    } else if (el.type === 'Polygon') {
      const pts = el.points.map(project)
      const path = el.closed && pts.length > 2 ? [...pts, pts[0]] : pts
      for (let i = 1; i < path.length; i++) segments.push({ from: path[i - 1], to: path[i] })
      const centroid = {
        x: pts.reduce((sum, p) => sum + p.x, 0) / pts.length,
        y: pts.reduce((sum, p) => sum + p.y, 0) / pts.length,
      }
      el.labels?.slice(0, pts.length).forEach((text, i) => {
        dots.push(squareAround(pts[i], 22))
        labels.push({
          id: vertexLabelId(el.id, i),
          anchor: pts[i],
          width: estimateTextWidth(text, 17),
          height: 22,
          gap: 10,
          preferred: { x: pts[i].x - centroid.x, y: pts[i].y - centroid.y },
        })
      })
    } else if (el.type === 'Circle') {
      // Approximate the circle with chords so labels and cards avoid its outline.
      const center = project(el.center)
      const edge = project({ x: el.center.x + el.radius, y: el.center.y })
      const r = Math.hypot(edge.x - center.x, edge.y - center.y)
      const at = (i: number) => ({
        x: center.x + r * Math.cos((i / CIRCLE_CHORDS) * 2 * Math.PI),
        y: center.y + r * Math.sin((i / CIRCLE_CHORDS) * 2 * Math.PI),
      })
      for (let i = 0; i < CIRCLE_CHORDS; i++) segments.push({ from: at(i), to: at(i + 1) })
    } else if (el.type === 'Angle') {
      // The arc and its label sit within ~40px of the vertex.
      dots.push(squareAround(project(el.vertex), 56))
    } else if (el.type === 'TargetBeacon') {
      const at = project(el.position)
      dots.push(squareAround(at, 24))
      labels.push({ id: beaconLabelId(el.id), anchor: at, width: estimateTextWidth(el.label, 14), height: 20, gap: 14 })
    }
  }
  // Side lengths last: they float in free space and can shift around the others.
  for (const el of elements) {
    if (el.type !== 'MathLabel') continue
    labels.push({
      id: beaconLabelId(el.id),
      anchor: project(el.position),
      width: Math.min(260, estimateTextWidth(latexText(el.latex), 17)),
      height: 26,
      gap: 4,
      allowCenter: true,
    })
  }
  return { segments, dots, labels }
}

export function OverlayRenderer({ elements, visible, delays, frame, screen, onDismiss }: OverlayRendererProps) {
  const [heights, setHeights] = useState<Record<string, number>>({})
  // Re-render (and let cards re-measure) once formulas switch from source text to KaTeX.
  useKatexReady()
  const onMeasure = useCallback(
    (id: string, height: number) => setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height })),
    [],
  )

  const project = useCallback(
    (point: Point) =>
      frameToScreen(point, frame.contentRect, { width: frame.still.width, height: frame.still.height }, screen),
    [frame, screen],
  )

  const [dock, setDock] = useState<DockBox>(NO_DOCK)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
  const steps = useMemo(() => visible.filter(isCard).filter(isStep), [visible])

  // Labels first (they're tied to points), then floating cards flow around labels, dots and lines.
  // Everything keeps clear of the step dock.
  const { labelRects, placements } = useMemo(() => {
    // Above the controls the dock spans the width, so it shrinks the free area; beside the
    // photo it's just a box to avoid.
    const bottomDock = dock.height > 0 && !dock.side
    const dockInset = (base: typeof LABEL_INSETS) =>
      bottomDock ? { ...base, bottom: base.bottom + dock.height + 8 } : base
    const dockObstacles: Rect[] =
      dock.height > 0 && dock.side
        ? [{ left: dock.left - 8, top: dock.top - 8, width: dock.width + 16, height: dock.height + 16 }]
        : []
    const { segments, dots: pointDots, labels } = sceneGeometry(elements, project)
    const dots = [...pointDots, ...dockObstacles]
    const labelRects = layoutLabels(labels, dots, segments, screen, dockInset(LABEL_INSETS))
    const floating = elements
      .filter(isCard)
      .filter((el) => !isStep(el))
      .map((el) => ({ id: el.id, anchor: project(el.position), height: heights[el.id] ?? CARD_HEIGHT_ESTIMATE }))
    const placements = layoutCards(floating, [...dots, ...labelRects.values()], screen, {
      width: cardWidth(screen),
      insets: dockInset(CARD_INSETS),
      offset: CARD_OFFSET,
      segments,
    })
    return { labelRects, placements }
  }, [elements, heights, project, screen, dock])

  const delayOf = (id: string) => delays[id] ?? 0

  const render = (layer: 'svg' | 'html') =>
    visible
      .filter((element) => registry[element.type].layer === layer && !isStep(element))
      .map((element) => {
        const Component = registry[element.type].component as ComponentType<OverlayElementProps<ARElement>>
        return (
          <Component
            key={element.id}
            element={element}
            project={project}
            screen={screen}
            delay={delayOf(element.id)}
            onDismiss={onDismiss}
            placement={placements.get(element.id)}
            onMeasure={onMeasure}
            labelRects={labelRects}
          />
        )
      })

  const leaders = visible.flatMap((el) => {
    const rect = isCard(el) && !isStep(el) ? placements.get(el.id) : undefined
    if (!rect || !isCard(el)) return []
    const anchor = project(el.position)
    const end = nearestPoint(rect, anchor)
    if (Math.hypot(end.x - anchor.x, end.y - anchor.y) < LEADER_MIN_DISTANCE) return []
    return (
      <motion.g
        key={`leader-${el.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ duration: 0.3, delay: delayOf(el.id) }}
      >
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={end.x}
          y2={end.y}
          stroke="rgb(255 255 255 / 0.7)"
          strokeWidth={1.5}
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
        <circle cx={anchor.x} cy={anchor.y} r={3} fill="white" />
      </motion.g>
    )
  })

  const current = steps.find((s) => s.id === currentStep)
  const pulseAt = current ? project(current.position) : null

  return (
    <OverlayRoot
      size={screen}
      lines={
        <AnimatePresence>
          {render('svg')}
          {leaders}
          {pulseAt && (
            // Shows where on the photo the step in the dock applies.
            <motion.circle
              key={`pulse-${currentStep}`}
              cx={pulseAt.x}
              cy={pulseAt.y}
              fill="none"
              stroke="white"
              strokeWidth={2}
              initial={{ r: 8, opacity: 0.9 }}
              animate={{ r: 26, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      }
    >
      <AnimatePresence>{render('html')}</AnimatePresence>
      <AnimatePresence>
        {steps.length > 0 && (
          <StepDock
            key="dock"
            steps={steps}
            delays={delays}
            project={project}
            screen={screen}
            onDismissAll={(ids) => ids.forEach(onDismiss)}
            onCurrentChange={setCurrentStep}
            onSize={setDock}
          />
        )}
      </AnimatePresence>
    </OverlayRoot>
  )
}
