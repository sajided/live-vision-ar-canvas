import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings: the Web Speech API isn't in lib.dom for all targets.
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

/** How long to wait for the final transcript after release. */
const FINALIZE_TIMEOUT_MS = 1500

export interface SpeechResult {
  text: string
  error: string | null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked.',
  'service-not-allowed': 'Speech recognition is not allowed in this browser.',
  network: 'Speech recognition needs a network connection.',
  'audio-capture': 'No microphone was found.',
}

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<Recognition | null>(null)
  const transcriptRef = useRef('')
  const errorRef = useRef<string | null>(null)
  const finishRef = useRef<(() => void) | null>(null)

  const cancel = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    finishRef.current = null
    if (recognition) {
      recognition.onend = recognition.onresult = recognition.onerror = null
      recognition.abort()
    }
    setListening(false)
    setTranscript('')
  }, [])

  const start = useCallback(() => {
    if (!Ctor) return
    cancel()
    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    transcriptRef.current = ''
    errorRef.current = null

    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      transcriptRef.current = text.trim()
      setTranscript(transcriptRef.current)
    }
    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' just mean an empty transcript.
      errorRef.current = ERROR_MESSAGES[event.error] ?? null
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      finishRef.current?.()
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    setTranscript('')
  }, [cancel])

  /** Stop listening and resolve with the final transcript. */
  const stop = useCallback((): Promise<SpeechResult> => {
    const recognition = recognitionRef.current
    const result = () => ({ text: transcriptRef.current, error: errorRef.current })
    if (!recognition) return Promise.resolve(result())

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cancel()
        resolve(result())
      }, FINALIZE_TIMEOUT_MS)
      finishRef.current = () => {
        clearTimeout(timer)
        finishRef.current = null
        setTranscript('')
        resolve(result())
      }
      recognition.stop()
    })
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return { supported: Boolean(Ctor), listening, transcript, start, stop, cancel }
}
