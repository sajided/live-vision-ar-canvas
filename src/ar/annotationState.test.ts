import { describe, expect, it } from 'vitest'
import { annotationReducer, initialAnnotationState, STAGGER_MS, type AnnotationState } from './annotationState'
import type { ARElement } from './schema'

const beacon = (id: string): ARElement => ({
  id,
  type: 'TargetBeacon',
  position: { x: 50, y: 50 },
  label: id,
  color: 'blue',
})

const started = annotationReducer(initialAnnotationState, { type: 'start' })

describe('annotationReducer', () => {
  it('moves from waiting to streaming as elements arrive', () => {
    expect(started.status).toBe('waiting')
    const next = annotationReducer(started, { type: 'element', element: beacon('a'), now: 1000, drawSeconds: 0 })
    expect(next.status).toBe('streaming')
    expect(next.elements.map((e) => e.id)).toEqual(['a'])
    expect(next.delays.a).toBe(0)
  })

  it('staggers bursts but does not delay slow streams', () => {
    let state: AnnotationState = started
    state = annotationReducer(state, { type: 'element', element: beacon('a'), now: 1000, drawSeconds: 0 })
    state = annotationReducer(state, { type: 'element', element: beacon('b'), now: 1000, drawSeconds: 0 })
    state = annotationReducer(state, { type: 'element', element: beacon('c'), now: 1010, drawSeconds: 0 })
    expect(state.delays.b).toBeCloseTo(STAGGER_MS / 1000)
    expect(state.delays.c).toBeCloseTo((2 * STAGGER_MS - 10) / 1000)
    state = annotationReducer(state, { type: 'element', element: beacon('d'), now: 5000, drawSeconds: 0 })
    expect(state.delays.d).toBe(0)
  })

  it('makes later elements wait until a traced figure is drawn', () => {
    let state = annotationReducer(started, { type: 'element', element: beacon('fig'), now: 1000, drawSeconds: 1.5 })
    state = annotationReducer(state, { type: 'element', element: beacon('label'), now: 1100, drawSeconds: 0 })
    expect(state.delays.label).toBeCloseTo(1.4)
  })

  it('ignores duplicate ids', () => {
    const once = annotationReducer(started, { type: 'element', element: beacon('a'), now: 0, drawSeconds: 0 })
    expect(annotationReducer(once, { type: 'element', element: beacon('a'), now: 5, drawSeconds: 0 })).toBe(once)
  })

  it('dismisses, clears and resets', () => {
    let state = annotationReducer(started, { type: 'element', element: beacon('a'), now: 0, drawSeconds: 0 })
    state = annotationReducer(state, { type: 'element', element: beacon('b'), now: 0, drawSeconds: 0 })
    expect([...annotationReducer(state, { type: 'dismiss', id: 'a' }).dismissed]).toEqual(['a'])
    expect(annotationReducer(state, { type: 'clear' }).dismissed.size).toBe(2)
    expect(annotationReducer(state, { type: 'reset' })).toBe(initialAnnotationState)
  })

  it('restarting drops previous elements', () => {
    const state = annotationReducer(started, { type: 'element', element: beacon('a'), now: 0, drawSeconds: 0 })
    expect(annotationReducer(state, { type: 'start' }).elements).toEqual([])
  })
})
