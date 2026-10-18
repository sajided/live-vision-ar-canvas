import type { ARElement } from '../ar/schema'

/** What the tutor says for an element: its `say`, else a spoken version of its card text. */
export function spokenText(element: ARElement): string | null {
  if (element.say) return element.say
  if (element.type === 'InfoCard') return `${element.title}. ${element.body}`
  if (element.type === 'Formula' && element.caption) return element.caption
  if (element.type === 'Diagram' && element.title) return element.title
  return null
}

export interface LessonDeps {
  /** Make the element visible (starts its drawing animation). */
  release: (element: ARElement) => void
  /** Speak a line; resolves when done. */
  speak: (text: string, signal: AbortSignal) => Promise<void>
  /** How long the element takes to draw, in ms. */
  drawMs: (element: ARElement) => number
  sleep: (ms: number, signal: AbortSignal) => Promise<void>
  onSpeaking: (element: ARElement | null, text: string | null) => void
  signal: AbortSignal
}

/** Minimum pause between silent elements, so they don't all pop at once. */
export const BEAT_MS = 250

/**
 * Present elements like a tutor at a board: show one, draw it while saying
 * its line, and only move on once both are done. Picks up where it left off
 * as more elements stream in (`from` = first element not yet presented).
 */
export async function presentFrom(elements: readonly ARElement[], from: number, deps: LessonDeps): Promise<number> {
  let i = from
  for (; i < elements.length; i++) {
    if (deps.signal.aborted) break
    const element = elements[i]
    deps.release(element)
    const text = spokenText(element)
    const waits = [deps.sleep(Math.max(BEAT_MS, deps.drawMs(element)), deps.signal)]
    if (text) {
      deps.onSpeaking(element, text)
      waits.push(deps.speak(text, deps.signal))
    }
    await Promise.all(waits)
    deps.onSpeaking(null, null)
  }
  return i
}
