import { motion } from 'motion/react'
import type { Rect } from '../../ar/layout'
import type { PxPoint } from '../../ar/project'
import { circlePath } from '../../ar/shapes'
import { edgeTimeline } from '../../ar/trace'

interface DrawnPathProps {
  d: string
  color: string
  width: number
  delay: number
  duration?: number
  /** Dark under-stroke for legibility over photos; 0 disables it. */
  outline?: number
  fill?: boolean
  dashed?: boolean
  ease?: 'linear' | 'easeInOut'
}

/** A path that draws itself on (pathLength 0 → 1), optionally filled afterwards. */
export function DrawnPath({
  d,
  color,
  width,
  delay,
  duration = 0.6,
  outline = 3,
  fill = false,
  dashed = false,
  ease = 'easeInOut',
}: DrawnPathProps) {
  const draw = {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: { duration, ease, delay },
  }
  // pathLength animates via dasharray, so dashed paths fade in instead.
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3, delay },
  }
  const reveal = dashed ? fade : draw
  return (
    <>
      {fill && (
        <motion.path
          d={d}
          fill={color}
          fillOpacity={0.16}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay + duration * 0.8 }}
        />
      )}
      {outline > 0 && (
        <motion.path
          d={d}
          fill="none"
          stroke="rgb(0 0 0 / 0.35)"
          strokeWidth={width + outline}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? `${width * 3} ${width * 3}` : undefined}
          {...reveal}
        />
      )}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? `${width * 3} ${width * 3}` : undefined}
        {...reveal}
      />
    </>
  )
}

interface SvgTagProps {
  at: PxPoint
  text: string
  size: number
  delay: number
}

/** Short plain-text tag (angle value, point name) with a halo for legibility. */
export function SvgTag({ at, text, size, delay }: SvgTagProps) {
  return (
    <motion.text
      x={at.x}
      y={at.y}
      fontSize={size}
      fontWeight={600}
      fill="white"
      stroke="rgb(0 0 0 / 0.6)"
      strokeWidth={size / 5}
      paintOrder="stroke"
      textAnchor="middle"
      dominantBaseline="central"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay }}
    >
      {text}
    </motion.text>
  )
}

interface PenTipProps {
  /** Keyframe positions along the traced path. */
  points: PxPoint[]
  /** Fraction of `duration` at each keyframe. */
  times: number[]
  delay: number
  duration: number
  color: string
  radius: number
}

/** Glowing pen tip that travels along a path while it is being drawn. */
export function PenTip({ points, times, delay, duration, color, radius }: PenTipProps) {
  if (points.length < 2) return null
  const linger = 0.25
  const total = duration + linger
  const move = { duration, delay, times, ease: 'linear' as const }
  return (
    <motion.g
      initial={{ x: points[0].x, y: points[0].y, opacity: 0 }}
      animate={{ x: points.map((p) => p.x), y: points.map((p) => p.y), opacity: [0, 1, 1, 0] }}
      transition={{
        x: move,
        y: move,
        opacity: { duration: total, delay, times: [0, Math.min(0.05 / total, 0.2), duration / total, 1] },
      }}
    >
      <circle r={radius * 2.4} fill={color} fillOpacity={0.3} />
      <circle r={radius} fill="white" stroke={color} strokeWidth={radius * 0.5} />
    </motion.g>
  )
}

interface TracedPathProps {
  points: PxPoint[]
  closed: boolean
  color: string
  /** Per-edge stroke colors (cycled); defaults to `color` for every edge. */
  edgeColors?: readonly string[]
  width: number
  delay: number
  duration: number
  outline?: number
  fill?: boolean
  penRadius: number
}

/** Draw a polyline edge by edge at constant speed, led by a pen tip. */
export function TracedPath({
  points,
  closed,
  color,
  edgeColors,
  width,
  delay,
  duration,
  outline = 3,
  fill = false,
  penRadius,
}: TracedPathProps) {
  const path = closed && points.length > 2 ? [...points, points[0]] : points
  const { starts, spans, times } = edgeTimeline(path)
  const edges = path.slice(1).map((to, i) => ({ d: `M${path[i].x} ${path[i].y}L${to.x} ${to.y}`, i }))
  const fillPath = `M${points.map((p) => `${p.x} ${p.y}`).join('L')}Z`

  const edgeColor = (i: number) => (edgeColors?.length ? edgeColors[i % edgeColors.length] : color)
  const edgeLayer = (stroke: string | null, strokeWidth: number) =>
    edges.map(({ d, i }) => (
      <motion.path
        key={i}
        d={d}
        fill="none"
        stroke={stroke ?? edgeColor(i)}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: duration * spans[i], delay: delay + duration * starts[i], ease: 'linear' },
          // Hide the zero-length round cap until this edge starts.
          opacity: { duration: 0.01, delay: delay + duration * starts[i] },
        }}
      />
    ))

  return (
    <>
      {fill && closed && (
        <motion.path
          d={fillPath}
          fill={color}
          fillOpacity={0.16}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: delay + duration }}
        />
      )}
      {outline > 0 && edgeLayer('rgb(0 0 0 / 0.35)', width + outline)}
      {edgeLayer(null, width)}
      <PenTip points={path} times={times} delay={delay} duration={duration} color={color} radius={penRadius} />
    </>
  )
}

const CIRCLE_PEN_STEPS = 48

interface TracedCircleProps {
  center: PxPoint
  radius: number
  color: string
  width: number
  delay: number
  duration: number
  outline?: number
  penRadius: number
}

/** Draw a circle with a pen tip following the stroke. */
export function TracedCircle({ center, radius, color, width, delay, duration, outline = 3, penRadius }: TracedCircleProps) {
  // circlePath starts at the leftmost point and sweeps through the bottom: θ = π − 2πt.
  const pen = Array.from({ length: CIRCLE_PEN_STEPS + 1 }, (_, i) => {
    const theta = Math.PI - (2 * Math.PI * i) / CIRCLE_PEN_STEPS
    return { x: center.x + radius * Math.cos(theta), y: center.y + radius * Math.sin(theta) }
  })
  const times = pen.map((_, i) => i / CIRCLE_PEN_STEPS)
  return (
    <>
      <DrawnPath
        d={circlePath(center, radius)}
        color={color}
        width={width}
        outline={outline}
        delay={delay}
        duration={duration}
        ease="linear"
      />
      <PenTip points={pen} times={times} delay={delay} duration={duration} color={color} radius={penRadius} />
    </>
  )
}

interface VertexMarkerProps {
  at: PxPoint
  /** Direction to push the label away from the figure. */
  outward: PxPoint
  label?: string
  /** Where to center the label, if a layout pass placed it. */
  labelAt?: PxPoint
  color: string
  delay: number
  /** 1 = screen pixels; smaller inside diagram boards. */
  scale?: number
}

/** Colored vertex dot with its name in matching colored text (no background). */
export function VertexMarker({ at, outward, label, labelAt, color, delay, scale = 1 }: VertexMarkerProps) {
  const length = Math.hypot(outward.x, outward.y) || 1
  const offset = 20 * scale
  const text = labelAt ?? { x: at.x + (outward.x / length) * offset, y: at.y + (outward.y / length) * offset }
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay }}
      style={{ transformOrigin: `${at.x}px ${at.y}px` }}
    >
      <circle cx={at.x} cy={at.y} r={11 * scale} fill={color} fillOpacity={0.3} />
      <circle cx={at.x} cy={at.y} r={6 * scale} fill={color} stroke="white" strokeWidth={2 * scale} />
      {label && (
        <text
          data-overlay="label"
          x={text.x}
          y={text.y}
          fill={color}
          stroke="rgb(0 0 0 / 0.85)"
          strokeWidth={4 * scale}
          paintOrder="stroke"
          strokeLinejoin="round"
          fontSize={17 * scale}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </motion.g>
  )
}

const centerOf = (rect?: Rect) =>
  rect && { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

/** Markers for a traced polygon's labelled vertices, popping in as the pen reaches each one. */
export function VertexMarkers({
  points,
  labels,
  closed,
  colors,
  labelRect,
  delay,
  duration,
  scale,
}: {
  points: PxPoint[]
  labels?: string[]
  closed: boolean
  /** Per-vertex colors (cycled). */
  colors: readonly string[]
  /** Layout box for vertex i's label, if placed by the renderer. */
  labelRect?: (index: number) => Rect | undefined
  delay: number
  duration: number
  scale?: number
}) {
  if (!labels?.length) return null
  const path = closed && points.length > 2 ? [...points, points[0]] : points
  const { times } = edgeTimeline(path)
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  }
  return (
    <>
      {points.slice(0, labels.length).map((p, i) => (
        <VertexMarker
          key={i}
          at={p}
          // Away from the centroid; straight up if the point is the centroid (e.g. a 2-point segment).
          outward={p.x === centroid.x && p.y === centroid.y ? { x: 0, y: -1 } : { x: p.x - centroid.x, y: p.y - centroid.y }}
          label={labels[i]}
          labelAt={centerOf(labelRect?.(i))}
          color={colors[i % colors.length]}
          delay={delay + duration * times[i]}
          scale={scale}
        />
      ))}
    </>
  )
}
