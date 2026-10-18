import type { Size } from '../camera/geometry'
import { nearestPoint, overlapArea, segmentIntersectsRect, SEGMENT_PENALTY, type Insets, type Rect, type Segment } from './layout'
import type { PxPoint } from './project'

/**
 * Placement for short text labels tied to a point (beacon names, vertex
 * letters, side lengths): each picks the side of its point with the least
 * collision with other labels, dots, lines and the screen edges.
 */

export interface LabelRequest {
  id: string
  anchor: PxPoint
  width: number
  height: number
  /** Distance from the anchor to the nearest label edge. */
  gap: number
  /** Direction to try first (e.g. away from a polygon's center). */
  preferred?: PxPoint
  /** Allow sitting centered on the anchor (labels whose anchor is free space, like side lengths). */
  allowCenter?: boolean
}

/** Keys for label boxes shared between the renderer and the components. */
export const beaconLabelId = (id: string) => `label:${id}`
export const vertexLabelId = (id: string, index: number) => `vertex:${id}:${index}`

const DIRECTIONS: PxPoint[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
]
const OUT_OF_BOUNDS_WEIGHT = 50
/** Small cost per candidate rank so free spots prefer the earlier directions. */
const RANK_COST = 2
/** Cost per px a label ends up from its point, so clamped spots are a fallback, not a preference. */
const DRIFT_COST = 0.5

/** Rough rendered width of a bold label, without measuring the DOM. */
export function estimateTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.62) + 6
}

function rectAround(anchor: PxPoint, dir: PxPoint, gap: number, width: number, height: number): Rect {
  const length = Math.hypot(dir.x, dir.y)
  if (length === 0) return { left: anchor.x - width / 2, top: anchor.y - height / 2, width, height }
  const ux = dir.x / length
  const uy = dir.y / length
  // Push the center out far enough that the rect edge (not center) sits `gap` away.
  const reach = gap + Math.min(Math.abs(ux) > 1e-6 ? width / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? height / 2 / Math.abs(uy) : Infinity)
  const cx = anchor.x + ux * reach
  const cy = anchor.y + uy * reach
  return { left: cx - width / 2, top: cy - height / 2, width, height }
}

/** Shift a rect the least distance needed to sit inside the free area. */
function clampInto(rect: Rect, screen: Size, insets: Insets): Rect {
  const maxLeft = screen.width - insets.right - rect.width
  const maxTop = screen.height - insets.bottom - rect.height
  return {
    ...rect,
    left: Math.min(Math.max(rect.left, insets.left), Math.max(insets.left, maxLeft)),
    top: Math.min(Math.max(rect.top, insets.top), Math.max(insets.top, maxTop)),
  }
}

function outOfBounds(rect: Rect, screen: Size, insets: Insets): number {
  const inner = {
    left: insets.left,
    top: insets.top,
    width: screen.width - insets.left - insets.right,
    height: screen.height - insets.top - insets.bottom,
  }
  return rect.width * rect.height - overlapArea(rect, inner)
}

export function layoutLabels(
  labels: LabelRequest[],
  obstacles: Rect[],
  segments: Segment[],
  screen: Size,
  insets: Insets,
): Map<string, Rect> {
  const placed = new Map<string, Rect>()
  for (const label of labels) {
    const candidates: PxPoint[] = [
      ...(label.allowCenter ? [{ x: 0, y: 0 }] : []),
      ...(label.preferred ? [label.preferred] : []),
      ...DIRECTIONS,
    ]
    let best: Rect | null = null
    let bestScore = Infinity
    // Each direction as-is, then pushed back inside the free area (for anchors under the dock or near an edge).
    const rects = candidates.flatMap((dir) => {
      const rect = rectAround(label.anchor, dir, label.gap, label.width, label.height)
      return [rect, clampInto(rect, screen, insets)]
    })
    rects.forEach((rect, rank) => {
      const overlap = [...obstacles, ...placed.values()].reduce((sum, other) => sum + overlapArea(rect, other), 0)
      const crossings = segments.filter((s) => segmentIntersectsRect(s, rect)).length
      const near = nearestPoint(rect, label.anchor)
      const drift = Math.max(0, Math.hypot(near.x - label.anchor.x, near.y - label.anchor.y) - label.gap)
      const score =
        overlap * 10 +
        crossings * SEGMENT_PENALTY +
        outOfBounds(rect, screen, insets) * OUT_OF_BOUNDS_WEIGHT +
        rank * RANK_COST +
        drift * DRIFT_COST
      if (score < bestScore) {
        best = rect
        bestScore = score
      }
    })
    if (best) placed.set(label.id, best)
  }
  return placed
}
