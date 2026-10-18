import type { Size } from '../camera/geometry'
import { overlapArea, segmentIntersectsRect, SEGMENT_PENALTY, type Insets, type Rect, type Segment } from './layout'
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
const RANK_COST = 4

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
    candidates.forEach((dir, rank) => {
      const rect = rectAround(label.anchor, dir, label.gap, label.width, label.height)
      const overlap = [...obstacles, ...placed.values()].reduce((sum, other) => sum + overlapArea(rect, other), 0)
      const crossings = segments.filter((s) => segmentIntersectsRect(s, rect)).length
      const score =
        overlap * 10 + crossings * SEGMENT_PENALTY + outOfBounds(rect, screen, insets) * OUT_OF_BOUNDS_WEIGHT + rank * RANK_COST
      if (score < bestScore) {
        best = rect
        bestScore = score
      }
    })
    if (best) placed.set(label.id, best)
  }
  return placed
}
