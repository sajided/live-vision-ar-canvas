import type { ARElement, BoardShape, Point } from './schema'

/**
 * Timing for the pen-tracing animation. Durations come from schema
 * coordinates (0–100 units), so the reveal schedule and the components agree
 * without knowing the screen size.
 */

/** Pen speed in coordinate units (percent of the image or board) per second. */
export const TRACE_SPEED = 100
const MIN_TRACE_SECONDS = 0.25
const MAX_TRACE_SECONDS = 3
export const ANGLE_SECONDS = 0.35
/** Time for a card to slide in before its diagram starts drawing. */
export const CARD_ENTER_SECONDS = 0.3

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

export function pathLength(points: Point[], closed: boolean): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i])
  if (closed && points.length > 2) length += dist(points[points.length - 1], points[0])
  return length
}

export function traceSeconds(length: number): number {
  return Math.min(MAX_TRACE_SECONDS, Math.max(MIN_TRACE_SECONDS, length / TRACE_SPEED))
}

export function boardShapeDuration(shape: BoardShape): number {
  switch (shape.kind) {
    case 'polygon':
      return traceSeconds(pathLength(shape.points, shape.closed))
    case 'circle':
      return traceSeconds(2 * Math.PI * shape.radius)
    case 'segment':
      return traceSeconds(dist(shape.from, shape.to))
    case 'angle':
      return ANGLE_SECONDS
    case 'point':
    case 'label':
      return 0.1
  }
}

/** When each diagram shape starts, relative to the diagram's own delay. */
export function boardShapeOffsets(shapes: BoardShape[]): number[] {
  let t = CARD_ENTER_SECONDS
  return shapes.map((shape) => {
    const start = t
    t += boardShapeDuration(shape)
    return start
  })
}

/** How long an element takes to draw; the next element waits for it. 0 = appears instantly. */
export function traceDuration(element: ARElement): number {
  switch (element.type) {
    case 'Polygon':
      return traceSeconds(pathLength(element.points, element.closed))
    case 'Circle':
      return traceSeconds(2 * Math.PI * element.radius)
    case 'ConnectorLine':
      return traceSeconds(dist(element.from, element.to))
    case 'Angle':
      return ANGLE_SECONDS
    case 'Diagram':
      return element.shapes.reduce((sum, shape) => sum + boardShapeDuration(shape), CARD_ENTER_SECONDS)
    default:
      return 0
  }
}

export interface TraceTimeline {
  /** Start of each edge as a fraction of the total duration. */
  starts: number[]
  /** Length of each edge as a fraction of the total duration. */
  spans: number[]
  /** Cumulative fraction at each vertex, for pen keyframe `times`. */
  times: number[]
}

/** Split a trace across edges in proportion to their length (pen moves at constant speed). */
export function edgeTimeline(points: Point[]): TraceTimeline {
  const lengths = points.slice(1).map((p, i) => dist(points[i], p))
  const total = lengths.reduce((a, b) => a + b, 0) || 1
  const times = [0]
  const starts: number[] = []
  const spans: number[] = []
  let acc = 0
  for (const length of lengths) {
    starts.push(acc / total)
    spans.push(length / total)
    acc += length
    times.push(acc / total)
  }
  return { starts, spans, times }
}
