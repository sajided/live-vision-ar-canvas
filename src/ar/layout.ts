import type { Size } from '../camera/geometry'
import type { PxPoint } from './project'

/**
 * Collision-aware placement for InfoCards. Pure and DOM-free: callers supply
 * measured card heights and obstacle rects (beacons) in screen pixels.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface CardRequest {
  id: string
  anchor: PxPoint
  height: number
}

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Segment {
  from: PxPoint
  to: PxPoint
}

/** Whether a line segment passes through (or ends inside) a rectangle. */
export function segmentIntersectsRect({ from, to }: Segment, rect: Rect): boolean {
  // Liang–Barsky clipping against the rectangle.
  const dx = to.x - from.x
  const dy = to.y - from.y
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, from.x - rect.left],
    [dx, rect.left + rect.width - from.x],
    [-dy, from.y - rect.top],
    [dy, rect.top + rect.height - from.y],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

/** Penalty, in overlap-area units, for each line a card or label would cover. */
export const SEGMENT_PENALTY = 300

export interface LayoutOptions {
  width: number
  insets: Insets
  /** Gap between a card and its anchor. */
  offset: number
  /** Vertical step for the fallback scan. */
  step?: number
  /** Lines (figure edges, connectors) to keep text off. */
  segments?: Segment[]
}

const ANCHOR_SIZE = 24
const GRID_STEP_X = 32

/** Floating card width: roomy in portrait, narrower in landscape so cards fit beside things. */
export const cardWidth = (screen: Size) =>
  screen.width > screen.height ? Math.min(340, screen.width * 0.38) : Math.min(360, screen.width * 0.85)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/** Closest point on `rect` to `point`. */
export function nearestPoint(rect: Rect, point: PxPoint): PxPoint {
  return {
    x: clamp(point.x, rect.left, rect.left + rect.width),
    y: clamp(point.y, rect.top, rect.top + rect.height),
  }
}

export function squareAround(point: PxPoint, size: number): Rect {
  return { left: point.x - size / 2, top: point.y - size / 2, width: size, height: size }
}

/**
 * Place cards in order, each at the candidate position that overlaps least
 * with earlier cards, obstacles and every card's anchor, preferring spots
 * close to its own anchor.
 */
export function layoutCards(
  cards: CardRequest[],
  obstacles: Rect[],
  screen: Size,
  { width, insets, offset, step = 12, segments = [] }: LayoutOptions,
): Map<string, Rect> {
  const blocked = [...obstacles, ...cards.map((c) => squareAround(c.anchor, ANCHOR_SIZE))]
  const placements = new Map<string, Rect>()
  const minLeft = insets.left
  const maxLeft = screen.width - insets.right - width
  const minTop = insets.top

  for (const { id, anchor, height } of cards) {
    const maxTop = screen.height - insets.bottom - height
    const { x, y } = anchor
    const positions: [number, number][] = [
      [x - offset, y + offset], // below, extending right
      [x - width + offset, y + offset], // below, extending left
      [x - offset, y - offset - height], // above, extending right
      [x - width + offset, y - offset - height], // above, extending left
      [x + offset, y - height / 2], // right of anchor
      [x - offset - width, y - height / 2], // left of anchor
    ]
    for (let top = minTop; top <= maxTop; top += step) {
      positions.push([x - offset, top], [x - width + offset, top])
    }
    // Coarse grid over the whole free area, for crowded or short (landscape) screens.
    for (let top = minTop; top <= maxTop; top += step * 2) {
      for (let left = minLeft; left <= maxLeft; left += GRID_STEP_X) positions.push([left, top])
    }

    let best: Rect | null = null
    let bestScore = Infinity
    for (const [left, top] of positions) {
      const rect = { left: clamp(left, minLeft, maxLeft), top: clamp(top, minTop, maxTop), width, height }
      const overlap =
        [...blocked, ...placements.values()].reduce((sum, other) => sum + overlapArea(rect, other), 0) +
        segments.filter((s) => segmentIntersectsRect(s, rect)).length * SEGMENT_PENALTY
      const near = nearestPoint(rect, anchor)
      // Anything within `offset` counts as adjacent, so the preferred order breaks ties.
      const score = overlap * 10 + Math.max(offset, Math.hypot(near.x - x, near.y - y))
      if (score < bestScore) {
        best = rect
        bestScore = score
      }
    }
    if (best) placements.set(id, best)
  }

  return placements
}
