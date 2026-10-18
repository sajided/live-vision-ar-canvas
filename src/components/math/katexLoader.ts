import type KatexModule from 'katex'
import { useSyncExternalStore } from 'react'

type Katex = typeof KatexModule

let katex: Katex | null = null
let loading: Promise<Katex> | null = null
const listeners = new Set<() => void>()

/**
 * KaTeX (+ its CSS and fonts) is ~80 KB gzipped, so it loads on demand:
 * prefetched when a frame is captured, well before the first formula arrives.
 */
export function loadKatex(): Promise<Katex> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => {
    katex = mod.default
    listeners.forEach((notify) => notify())
    return katex
  })
  return loading
}

export function getKatex(): Katex | null {
  return katex
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Re-renders when KaTeX finishes loading. */
export function useKatexReady(): boolean {
  return useSyncExternalStore(subscribe, () => katex !== null)
}
