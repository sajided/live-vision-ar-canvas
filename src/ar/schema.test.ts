import { describe, expect, it } from 'vitest'
import { fixtures, invalidFixture } from '../mock/fixtures'
import { parseARResponse } from './parse'

const beacon = { id: 'b', type: 'TargetBeacon', position: { x: 10, y: 20 }, label: 'Pin' }

describe('parseARResponse', () => {
  it.each(Object.entries(fixtures))('accepts the %s fixture', (_, fixture) => {
    expect(parseARResponse(fixture).ok).toBe(true)
  })

  it('rejects the invalid fixture', () => {
    expect(parseARResponse(invalidFixture).ok).toBe(false)
  })

  it('fills in defaults', () => {
    const result = parseARResponse({
      elements: [beacon, { id: 'l', type: 'ConnectorLine', from: { x: 0, y: 0 }, to: { x: 100, y: 100 } }],
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.data.elements[0]).toMatchObject({ color: 'blue' })
    expect(result.data.elements[1]).toMatchObject({ color: 'blue', variant: 'arrow' })
  })

  it('accepts JSON strings', () => {
    expect(parseARResponse(JSON.stringify({ elements: [beacon] })).ok).toBe(true)
    expect(parseARResponse('{not json')).toEqual({ ok: false, error: 'Response is not valid JSON' })
  })

  it.each([
    ['duplicate ids', { elements: [beacon, beacon] }],
    ['out-of-range coordinates', { elements: [{ ...beacon, position: { x: 101, y: 0 } }] }],
    ['extra keys', { elements: [{ ...beacon, onClick: 'alert(1)' }] }],
    ['unknown type', { elements: [{ ...beacon, type: 'Spotlight' }] }],
    ['unknown color', { elements: [{ ...beacon, color: 'url(javascript:x)' }] }],
    ['empty elements', { elements: [] }],
    ['non-integer stepIndex', { elements: [{ id: 'c', type: 'InfoCard', position: { x: 1, y: 1 }, title: 't', body: 'b', stepIndex: 1.5 }] }],
  ])('rejects %s', (_, raw) => {
    const result = parseARResponse(raw)
    expect(result.ok).toBe(false)
  })

  it('reports the failing path', () => {
    const result = parseARResponse({ elements: [beacon, beacon] })
    expect(result).toEqual({ ok: false, error: 'elements.1.id: Duplicate id "b"' })
  })
})

describe('math elements', () => {
  const parse = (element: object) => parseARResponse({ elements: [element] })

  it('accepts formulas, labels and geometry with defaults filled in', () => {
    const result = parseARResponse({
      elements: [
        { id: 'f', type: 'Formula', position: { x: 50, y: 50 }, latex: '\\frac{a}{b}', stepIndex: 1 },
        { id: 'l', type: 'MathLabel', position: { x: 10, y: 10 }, latex: 'a = 3' },
        { id: 'p', type: 'Polygon', points: [{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 5, y: 9 }] },
        { id: 'c', type: 'Circle', center: { x: 50, y: 50 }, radius: 20 },
        { id: 'a', type: 'Angle', vertex: { x: 0, y: 0 }, from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, label: 'θ' },
      ],
    })
    if (!result.ok) throw new Error(result.error)
    expect(result.data.elements[2]).toMatchObject({ closed: true, fill: false, color: 'blue' })
    expect(result.data.elements[4]).toMatchObject({ right: false })
  })

  it('accepts a diagram with every board shape kind', () => {
    const result = parse({
      id: 'd',
      type: 'Diagram',
      position: { x: 50, y: 50 },
      caption: 'y = x^2',
      shapes: [
        { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { kind: 'circle', center: { x: 50, y: 50 }, radius: 10 },
        { kind: 'segment', from: { x: 0, y: 80 }, to: { x: 100, y: 80 }, variant: 'arrow' },
        { kind: 'angle', vertex: { x: 0, y: 0 }, from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, right: true },
        { kind: 'point', position: { x: 40, y: 80 }, label: 'A' },
        { kind: 'label', position: { x: 80, y: 20 }, latex: 'f(x)' },
      ],
    })
    expect(result.ok).toBe(true)
  })

  it.each([
    ['a one-point polygon', { id: 'p', type: 'Polygon', points: [{ x: 1, y: 1 }] }],
    ['a zero radius', { id: 'c', type: 'Circle', center: { x: 1, y: 1 }, radius: 0 }],
    ['an over-long angle tag', { id: 'a', type: 'Angle', vertex: { x: 0, y: 0 }, from: { x: 1, y: 0 }, to: { x: 0, y: 1 }, label: 'a very long angle label' }],
    ['an unknown board shape', { id: 'd', type: 'Diagram', position: { x: 1, y: 1 }, shapes: [{ kind: 'spiral' }] }],
    ['an empty diagram', { id: 'd', type: 'Diagram', position: { x: 1, y: 1 }, shapes: [] }],
    ['empty latex', { id: 'f', type: 'Formula', position: { x: 1, y: 1 }, latex: '' }],
  ])('rejects %s', (_, element) => {
    expect(parse(element).ok).toBe(false)
  })
})
