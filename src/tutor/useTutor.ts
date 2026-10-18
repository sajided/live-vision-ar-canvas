import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../ar/motionPrefs'
import type { ARElement } from '../ar/schema'
import type { AnnotationStatus } from '../ar/annotationState'
import { traceDuration } from '../ar/trace'
import { presentFrom, spokenText } from './lesson'
import { detectVoice, prefetchSpeech, speak, stopSpeaking } from './narrator'

const PREFETCH_AHEAD = 3

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })

export interface TutorState {
  /** Elements the tutor has reached; only these are shown while the tutor is on. */
  released: ReadonlySet<string>
  /** The line being spoken, for subtitles. */
  caption: string | null
}

/**
 * Paces an answer like a tutor: elements appear one at a time as they're
 * explained aloud. When `enabled` is false, nothing is gated or spoken.
 */
export function useTutor(elements: ARElement[], status: AnnotationStatus, enabled: boolean): TutorState {
  const [released, setReleased] = useState<ReadonlySet<string>>(new Set())
  const [caption, setCaption] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  /** Index the lesson resumes from after the voice is switched back on. */
  const [resumeFrom, setResumeFrom] = useState(0)
  const nextRef = useRef(0)
  const runningRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    void detectVoice()
  }, [])

  // A new question (or resume) starts a new lesson: reset state during render…
  const fresh = status === 'waiting' || status === 'idle'
  const [wasFresh, setWasFresh] = useState(fresh)
  if (fresh !== wasFresh) {
    setWasFresh(fresh)
    if (fresh) {
      setReleased(new Set())
      setCaption(null)
      setResumeFrom(0)
    }
  }
  // …and stop the previous lesson's audio.
  useEffect(() => {
    if (!fresh) return
    controllerRef.current?.abort()
    controllerRef.current = null
    stopSpeaking()
    nextRef.current = 0
    runningRef.current = false
  }, [fresh])

  // Turning the voice back on: whatever is already on screen counts as presented.
  const [wasEnabled, setWasEnabled] = useState(enabled)
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled)
    if (enabled) {
      setReleased(new Set(elements.map((el) => el.id)))
      setResumeFrom(elements.length)
    }
  }

  // Turning the voice off mid-lesson stops speaking; App then shows everything that's left.
  useEffect(() => {
    if (enabled) return
    controllerRef.current?.abort()
    controllerRef.current = null
    runningRef.current = false
    stopSpeaking()
  }, [enabled])

  // Fetch upcoming lines early so each starts the moment its turn comes.
  useEffect(() => {
    if (!enabled) return
    for (const el of elements.slice(nextRef.current, nextRef.current + PREFETCH_AHEAD)) {
      const text = spokenText(el)
      if (text) prefetchSpeech(text)
    }
  }, [elements, enabled, tick])

  useEffect(() => {
    nextRef.current = Math.max(nextRef.current, resumeFrom)
    if (!enabled || runningRef.current || nextRef.current >= elements.length) return
    runningRef.current = true
    controllerRef.current ??= new AbortController()
    const controller = controllerRef.current
    void presentFrom(elements, nextRef.current, {
      release: (el) => setReleased((prev) => new Set(prev).add(el.id)),
      speak,
      drawMs: (el) => (prefersReducedMotion() ? 0 : traceDuration(el) * 1000),
      sleep,
      onSpeaking: (_, text) => setCaption(text),
      signal: controller.signal,
    }).then((next) => {
      if (controller.signal.aborted) return
      nextRef.current = next
      runningRef.current = false
      // Elements that streamed in meanwhile are picked up on the next run.
      setTick((t) => t + 1)
    })
  }, [elements, enabled, tick, resumeFrom])

  useEffect(() => () => {
    controllerRef.current?.abort()
    stopSpeaking()
  }, [])

  return { released, caption: enabled ? caption : null }
}
