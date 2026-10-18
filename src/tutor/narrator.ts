/**
 * Tutor voice. Speaks through the server's ElevenLabs proxy (`/api/speech`)
 * and falls back to the browser's built-in speech synthesis when that isn't
 * configured or fails.
 */

const speechUrl = (text: string) => `/api/speech?text=${encodeURIComponent(text)}`

// A shared element that was "played" during a user gesture: iOS then lets it play later without one.
let audio: HTMLAudioElement | null = null
let elevenLabs: boolean | null = null
const prefetched = new Set<string>()

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

/** Call once at startup: unlocks audio playback on the first tap (iOS requires a gesture). */
export function unlockNarrationOnFirstGesture(): void {
  const unlock = () => {
    audio ??= new Audio()
    audio.src = SILENT_WAV
    void audio.play().catch(() => {})
    // speechSynthesis has the same gesture rule on iOS.
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  }
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
}

/** Ask the server whether ElevenLabs is configured (cached). */
export async function detectVoice(): Promise<boolean> {
  if (elevenLabs !== null) return elevenLabs
  try {
    const health = (await (await fetch('/api/health')).json()) as { tts?: boolean }
    elevenLabs = Boolean(health.tts)
  } catch {
    elevenLabs = false
  }
  return elevenLabs
}

/** Warm the server and browser caches so the line starts instantly when its turn comes. */
export function prefetchSpeech(text: string): void {
  if (!elevenLabs || prefetched.has(text)) return
  prefetched.add(text)
  fetch(speechUrl(text)).catch(() => prefetched.delete(text))
}

/** Time to read a line when it can't be spoken (~20 characters a second). */
export function readingMs(text: string): number {
  return Math.max(1200, text.length * 50)
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })

function speakWithBrowser(text: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  // No voice at all: keep the subtitle up long enough to read, so the lesson keeps its pace.
  if (!('speechSynthesis' in window)) return wait(readingMs(text), signal)
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.onend = utterance.onerror = () => resolve()
    signal.addEventListener('abort', () => (window.speechSynthesis.cancel(), resolve()), { once: true })
    window.speechSynthesis.speak(utterance)
  })
}

function speakWithElevenLabs(text: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    audio ??= new Audio()
    const player = audio
    const done = (ok: boolean) => {
      player.onended = player.onerror = null
      resolve(ok)
    }
    player.onended = () => done(true)
    player.onerror = () => done(false)
    signal.addEventListener('abort', () => (player.pause(), done(true)), { once: true })
    player.src = speechUrl(text)
    player.play().catch(() => done(false))
  })
}

/** Speak a line; resolves when it finishes (or is aborted). Never rejects. */
export async function speak(text: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return
  if (await detectVoice()) {
    if (await speakWithElevenLabs(text, signal)) return
    if (signal.aborted) return
  }
  await speakWithBrowser(text, signal)
}

/** Stop anything currently speaking. */
export function stopSpeaking(): void {
  audio?.pause()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
