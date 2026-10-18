import type { ARElement } from './schema'

/** Minimum gap between element entrances, so bursts still stagger. */
export const STAGGER_MS = 120

export type AnnotationStatus = 'idle' | 'waiting' | 'streaming' | 'ready' | 'error'

export interface AnnotationState {
  status: AnnotationStatus
  elements: ARElement[]
  /** Entry delay (seconds) per element id. */
  delays: Record<string, number>
  dismissed: ReadonlySet<string>
  /** Timestamp (ms) from which the next element may start (after the pen finishes). */
  nextFreeAt: number
}

export type AnnotationAction =
  | { type: 'start' }
  /** `drawSeconds`: how long the element takes to trace; later elements wait for it. */
  | { type: 'element'; element: ARElement; now: number; drawSeconds: number }
  | { type: 'finish'; ok: boolean }
  | { type: 'reset' }
  | { type: 'dismiss'; id: string }
  | { type: 'clear' }

export const initialAnnotationState: AnnotationState = {
  status: 'idle',
  elements: [],
  delays: {},
  dismissed: new Set(),
  nextFreeAt: 0,
}

export function annotationReducer(state: AnnotationState, action: AnnotationAction): AnnotationState {
  switch (action.type) {
    case 'start':
      return { ...initialAnnotationState, status: 'waiting' }
    case 'element': {
      if (state.elements.some((e) => e.id === action.element.id)) return state
      // Show immediately unless an earlier element is still entering or being traced.
      const revealAt = Math.max(action.now, state.nextFreeAt)
      return {
        ...state,
        status: 'streaming',
        elements: [...state.elements, action.element],
        delays: { ...state.delays, [action.element.id]: (revealAt - action.now) / 1000 },
        nextFreeAt: revealAt + Math.max(STAGGER_MS, action.drawSeconds * 1000),
      }
    }
    case 'finish':
      return { ...state, status: action.ok ? 'ready' : 'error' }
    case 'reset':
      return initialAnnotationState
    case 'dismiss':
      return { ...state, dismissed: new Set(state.dismissed).add(action.id) }
    case 'clear':
      return { ...state, dismissed: new Set(state.elements.map((e) => e.id)) }
  }
}
