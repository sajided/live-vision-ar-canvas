import type { PxPoint } from './project'

/** Pure SVG geometry helpers shared by overlay shapes and diagram boards. */

export function polygonPath(points: PxPoint[], closed: boolean): string {
  const [first, ...rest] = points
  if (!first) return ''
  return `M${first.x} ${first.y}${rest.map((p) => `L${p.x} ${p.y}`).join('')}${closed ? 'Z' : ''}`
}

export interface AngleMark {
  path: string
  /** Where to put the angle's label, just outside the mark. */
  labelAt: PxPoint
}

/**
 * Arc (or right-angle square) marking the smaller angle at `vertex`
 * between the rays towards `from` and `to`.
 */
export function angleMark(vertex: PxPoint, from: PxPoint, to: PxPoint, radius: number, right: boolean): AngleMark {
  const a1 = Math.atan2(from.y - vertex.y, from.x - vertex.x)
  const a2 = Math.atan2(to.y - vertex.y, to.x - vertex.x)
  let delta = a2 - a1
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta <= -Math.PI) delta += 2 * Math.PI
  const at = (angle: number, r: number) => ({ x: vertex.x + r * Math.cos(angle), y: vertex.y + r * Math.sin(angle) })
  const mid = a1 + delta / 2

  if (right) {
    const size = radius * 0.7
    const p1 = at(a1, size)
    const p3 = at(a2, size)
    const p2 = { x: p1.x + p3.x - vertex.x, y: p1.y + p3.y - vertex.y }
    return { path: `M${p1.x} ${p1.y}L${p2.x} ${p2.y}L${p3.x} ${p3.y}`, labelAt: at(mid, radius * 1.6) }
  }

  const start = at(a1, radius)
  const end = at(a2, radius)
  // In y-down screen space a positive delta is clockwise, which is SVG's sweep-flag 1.
  const sweep = delta > 0 ? 1 : 0
  return {
    path: `M${start.x} ${start.y}A${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`,
    labelAt: at(mid, radius * 1.7),
  }
}

export interface ArrowGeometry {
  /** Where the shaft should stop so it doesn't poke through the head. */
  shaftEnd: PxPoint
  /** SVG polygon points for the head. */
  head: string
}

export function arrowHead(from: PxPoint, to: PxPoint, size: number): ArrowGeometry {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const corner = (offset: number) => [to.x - size * Math.cos(angle + offset), to.y - size * Math.sin(angle + offset)]
  return {
    shaftEnd: { x: to.x - Math.cos(angle) * size * 0.6, y: to.y - Math.sin(angle) * size * 0.6 },
    head: [[to.x, to.y], corner(-0.45), corner(0.45)].map((p) => p.join(',')).join(' '),
  }
}

/** Circle as a path (two arcs) so it can be drawn on with pathLength. */
export function circlePath(center: PxPoint, radius: number): string {
  const { x, y } = center
  return `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0`
}
