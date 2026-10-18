import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { gemmaAnnotate, prefetchFrame, warmConnection } from './api/gemmaAnnotator'
import { OverlayRenderer } from './ar/OverlayRenderer'
import { useAnnotations, type Annotator } from './ar/useAnnotations'
import { captureFrame } from './camera/captureFrame'
import { captureSharpest } from './camera/captureSharpest'
import { describeQuality } from './camera/sharpness'
import { useStillImage } from './camera/useStillImage'
import { useCameraStream } from './camera/useCameraStream'
import { ControlBar } from './components/ControlBar'
import { DebugHud } from './components/DebugHud'
import { FrozenFrame } from './components/FrozenFrame'
import { MuteToggle } from './components/MuteToggle'
import { PermissionGate } from './components/PermissionGate'
import { ScanSweep } from './components/ScanSweep'
import { ShutterFlash } from './components/ShutterFlash'
import { QueryBar } from './components/QueryBar'
import { StatusPill } from './components/StatusPill'
import { TranscriptBubble } from './components/TranscriptBubble'
import { Viewfinder } from './components/Viewfinder'
import { loadKatex } from './components/math/katexLoader'
import { Subtitle } from './components/Subtitle'
import { feedback, isMuted, setMuted } from './feedback/feedback'
import { useTutor } from './tutor/useTutor'
import { useOnline } from './hooks/useOnline'
import { useToast } from './hooks/useToast'
import { useViewport } from './hooks/useViewport'
import { MOCK_SCENARIOS, mockAnnotate, type MockScenario } from './mock/mockProvider'
import { PROVIDERS, type Provider } from './providers'
import { useSpeechRecognition } from './speech/useSpeechRecognition'
import type { CapturedFrame } from './types/frame'

const params = new URLSearchParams(window.location.search)
const debug = params.has('debug')
const pick = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback
const initialProvider = pick(PROVIDERS, params.get('provider'), 'gemma')
const initialScenario = pick(MOCK_SCENARIOS, params.get('mock'), 'random')
// Still-image mode replaces the camera, for desktop testing and e2e tests.
const stillImageUrl = params.get('image')
const NO_DELAYS: Record<string, number> = {}

export default function App() {
  const camera = useCameraStream(!stillImageUrl)
  const still = useStillImage(stillImageUrl)
  const { status, error, videoSize, restart } = stillImageUrl ? still : camera
  const { videoRef } = camera
  const viewport = useViewport()
  const speech = useSpeechRecognition()
  const [frame, setFrame] = useState<CapturedFrame | null>(null)
  const frameRef = useRef<CapturedFrame | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [query, setQuery] = useState('')
  // The question bar covers the bottom of the answer, so it's only open while typing.
  const [queryOpen, setQueryOpen] = useState(false)
  const [provider, setProvider] = useState<Provider>(initialProvider)
  const [scenario, setScenario] = useState<MockScenario>(initialScenario)
  const [toast, showToast, dismissToast] = useToast()
  const online = useOnline()

  const annotate = useCallback<Annotator>(
    (f, q, signal) =>
      provider === 'mock' ? mockAnnotate(f.contentRect, { scenario, signal }) : gemmaAnnotate(f, q, signal),
    [provider, scenario],
  )
  const annotations = useAnnotations(annotate)
  const [muted, setMutedState] = useState(isMuted)
  // With the voice on, the tutor reveals each element as it explains it.
  const tutorOn = !muted
  const tutor = useTutor(annotations.elements, annotations.status, tutorOn)
  const visible = tutorOn ? annotations.visible.filter((el) => tutor.released.has(el.id)) : annotations.visible
  const delays = tutorOn ? NO_DELAYS : annotations.delays

  // Audio/haptic cues as elements appear: a pop for the first, a tick per numbered step.
  const cuedRef = useRef(new Set<string>())
  const cueTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    // The tutor's voice replaces the per-step cues.
    if (tutorOn) return
    // A new request (or reset) cancels cues still pending from the previous answer.
    if (annotations.status === 'waiting' || annotations.status === 'idle') {
      cueTimersRef.current.forEach(clearTimeout)
      cueTimersRef.current = []
      cuedRef.current.clear()
    }
    annotations.elements.forEach((el, i) => {
      if (cuedRef.current.has(el.id)) return
      cuedRef.current.add(el.id)
      const isStep = 'stepIndex' in el && el.stepIndex !== undefined
      if (i > 0 && !isStep) return
      const cue = i === 0 ? feedback.firstElement : feedback.step
      cueTimersRef.current.push(setTimeout(cue, (annotations.delays[el.id] ?? 0) * 1000))
    })
  }, [annotations.elements, annotations.delays, annotations.status, tutorOn])
  useEffect(() => () => cueTimersRef.current.forEach(clearTimeout), [])

  // Warm the connection once the camera is up, so the first question doesn't pay for it.
  const warmedRef = useRef(false)
  useEffect(() => {
    if (status !== 'live' || provider !== 'gemma' || warmedRef.current) return
    warmedRef.current = true
    warmConnection()
  }, [status, provider])

  useEffect(() => {
    frameRef.current = frame
    if (!frame) return
    return () => URL.revokeObjectURL(frame.previewUrl)
  }, [frame])

  /** Freeze on the current camera frame, or reuse the frame already frozen. */
  async function freeze(): Promise<CapturedFrame | null> {
    if (frameRef.current) return frameRef.current
    const video = stillImageUrl ? still.imageRef.current : videoRef.current
    if (!video || status !== 'live') return null
    setCapturing(true)
    try {
      void loadKatex()
      // Freeze the sharpest of a short burst rather than whatever frame the tap landed on.
      const { pixels, quality } = await captureSharpest(video)
      const captured = await captureFrame(video, { pixels })
      frameRef.current = captured
      setFrame(captured)
      feedback.shutter()
      const warning = describeQuality(quality)
      if (warning) showToast(warning, 'info', { label: 'Retake', onClick: retake })
      // Upload now, while the question is still being typed or spoken.
      if (provider === 'gemma' && online) void prefetchFrame(captured)
      return captured
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Capture failed')
      return null
    } finally {
      setCapturing(false)
    }
  }

  async function ask(target: CapturedFrame, text: string) {
    if (!online && provider === 'gemma') {
      showToast("You're offline — connect to ask a question")
      setQueryOpen(true)
      return
    }
    setQueryOpen(false)
    dismissToast()
    const { error: requestError, summary, shown, truncated } = await annotations.request(target, text)
    if (requestError) {
      feedback.error()
      const retry = { label: 'Retry', onClick: () => void ask(target, text) }
      showToast(requestError, 'error', truncated || shown === 0 ? retry : undefined)
      // Nothing to look at, so offer the bar again to retry or rephrase.
      if (shown === 0) setQueryOpen(true)
    } else if (summary) showToast(summary, 'info')
  }

  async function handleCapture() {
    if (await freeze()) setQueryOpen(true)
  }

  async function handleTalkEnd() {
    feedback.micStop()
    // Snap the frame on release (FR-2.1) while the transcript finalizes.
    const pending = freeze()
    const [captured, { text, error: speechError }] = await Promise.all([pending, speech.stop()])
    if (!captured) return
    if (speechError || !text) {
      setQueryOpen(true)
      return showToast(speechError ?? "Didn't catch that — type your question instead", speechError ? 'error' : 'info')
    }
    setQuery(text)
    void ask(captured, text)
  }

  function handleSubmit(text: string) {
    if (frame) void ask(frame, text)
  }

  function retake() {
    handleResume()
    dismissToast()
    // Let the live video take over before freezing again.
    setTimeout(() => void handleCapture(), 250)
  }

  function handleResume() {
    annotations.reset()
    speech.cancel()
    frameRef.current = null
    setFrame(null)
    setQuery('')
    setQueryOpen(false)
  }

  return (
    <main className="fixed inset-0 h-dvh w-screen overflow-hidden bg-black">
      <Viewfinder
        videoRef={videoRef}
        imageUrl={stillImageUrl}
        imageRef={still.imageRef}
        onImageLoad={still.onLoad}
        onImageError={still.onError}
      />
      {frame && <FrozenFrame still={frame.still} />}
      {frame && (
        <OverlayRenderer
          elements={annotations.elements}
          visible={visible}
          delays={delays}
          frame={frame}
          screen={viewport}
          onDismiss={annotations.dismiss}
        />
      )}
      {!frame && <PermissionGate status={status} error={error} onRetry={restart} />}
      <ShutterFlash flashKey={frame?.capturedAt ?? null} />
      <ScanSweep active={frame !== null && annotations.status === 'waiting'} />
      <MuteToggle
        muted={muted}
        onChange={(value) => {
          setMuted(value)
          setMutedState(value)
        }}
      />
      <Subtitle text={tutor.caption} />
      <StatusPill loading={annotations.status === 'waiting'} toast={toast} />
      <TranscriptBubble listening={speech.listening} transcript={speech.transcript} />
      <AnimatePresence>
        {frame && queryOpen && !speech.listening && (
          <QueryBar
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            autoFocus
            busy={annotations.status === 'waiting'}
          />
        )}
      </AnimatePresence>
      <ControlBar
        frozen={frame !== null}
        canCapture={status === 'live' && !capturing}
        canClear={annotations.visible.length > 0}
        speechSupported={speech.supported}
        listening={speech.listening}
        onCapture={handleCapture}
        onResume={handleResume}
        onClear={annotations.clear}
        onTalkStart={() => {
          feedback.micStart()
          speech.start()
        }}
        onTalkEnd={handleTalkEnd}
        onTalkCancel={speech.cancel}
        canType={frame !== null && !queryOpen && !speech.listening}
        onType={() => setQueryOpen(true)}
      />
      {debug && (
        <DebugHud
          status={status}
          viewport={viewport}
          videoSize={videoSize}
          frame={frame}
          provider={provider}
          onProviderChange={setProvider}
          scenario={scenario}
          onScenarioChange={setScenario}
          metrics={annotations.metrics}
        />
      )}
    </main>
  )
}
