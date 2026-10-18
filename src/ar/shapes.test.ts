import { describe, expect, it } from 'vitest'
import { angleMark, arrowHead, polygonPath } from './shapes'

describe('polygonPath', () => {
  it('builds open and closed paths', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]
    expect(polygonPath(pts, true)).toBe('M0 0L10 0L10 5Z')
    expect(polygonPath(pts, false)).toBe('M0 0L10 0L10 5')
    expect(polygonPath([], true)).toBe('')
  })
})

describe('angleMark', () => {
  const v = { x: 0, y: 0 }

  it('arcs the smaller angle and labels its bisector', () => {
    // Rays along +x and +y (down on screen): a 90° clockwise sweep.
    const mark = angleMark(v, { x: 10, y: 0 }, { x: 0, y: 10 }, 10, false)
    expect(mark.path).toBe('M10 0A10 10 0 0 1 6.123233995736766e-16 10')
    expect(mark.labelAt.x).toBeCloseTo(mark.labelAt.y)
    expect(mark.labelAt.x).toBeGreaterThan(0)
  })

  it('sweeps the other way when the rays are swapped', () => {
    expect(angleMark(v, { x: 0, y: 10 }, { x: 10, y: 0 }, 10, false).path).toContain(' 0 0 0 ')
  })

  it('takes the short way round across the ±180° seam', () => {
    // Rays at 170° and -170°: the small angle is 20°, through 180°.
    const from = { x: Math.cos((170 * Math.PI) / 180), y: Math.sin((170 * Math.PI) / 180) }
    const to = { x: Math.cos((-170 * Math.PI) / 180), y: Math.sin((-170 * Math.PI) / 180) }
    expect(angleMark(v, from, to, 10, false).labelAt.x).toBeLessThan(-16)
  })

  it('draws a square for right angles', () => {
    const mark = angleMark(v, { x: 10, y: 0 }, { x: 0, y: 10 }, 10, true)
    expect(mark.path.startsWith('M7 0L7 7L')).toBe(true)
  })
})

describe('arrowHead', () => {
  it('ends the head at the target and shortens the shaft', () => {
    const { head, shaftEnd } = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(head.startsWith('100,0 ')).toBe(true)
    expect(shaftEnd).toEqual({ x: 94, y: 0 })
  })
})
