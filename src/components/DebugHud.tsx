import { Bug, X } from 'lucide-react'
import { useState } from 'react'
import type { AnnotationMetrics } from '../ar/useAnnotations'
import type { Size } from '../camera/geometry'
import type { CameraStatus } from '../camera/useCameraStream'
import type { MockScenario } from '../mock/mockProvider'
import { PROVIDERS, type Provider } from '../providers'
import { MOCK_SCENARIOS } from '../mock/mockProvider'
import type { CapturedFrame } from '../types/frame'

interface DebugHudProps {
  status: CameraStatus
  viewport: Size
  videoSize: Size | null
  frame: CapturedFrame | null
  provider: Provider
  onProviderChange: (provider: Provider) => void
  scenario: MockScenario
  onScenarioChange: (scenario: MockScenario) => void
  metrics: AnnotationMetrics
}

/** PRD KPI: query trigger to first overlay. */
const FIRST_ELEMENT_TARGET_MS = 2500

const round = (n: number) => Math.round(n * 10) / 10

export function DebugHud({
  status,
  viewport,
  videoSize,
  frame,
  provider,
  onProviderChange,
  scenario,
  onScenarioChange,
  metrics,
}: DebugHudProps) {
  // Collapsed by default so it doesn't cover the answer.
  const [open, setOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copyMetrics() {
    const report = {
      userAgent: navigator.userAgent,
      viewport,
      video: videoSize,
      capture: frame && { captureMs: frame.captureMs, bytes: frame.blob.size, mimeType: frame.mimeType },
      runs: metrics.history,
    }
    const text = JSON.stringify(report, null, 2)
    console.info('[metrics]', text)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }
  const position = { top: 'max(0.5rem, env(safe-area-inset-top))' }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Show debug info"
        className="fixed left-2 z-50 flex size-8 items-center justify-center rounded-full bg-black/50 text-lime-300"
        style={position}
      >
        <Bug className="size-4" />
      </button>
    )
  }

  return (
    <div
      className="fixed left-2 z-50 max-w-[calc(100vw-1rem)] rounded-lg bg-black/70 p-2 pr-8 font-mono text-[11px] leading-relaxed text-lime-300"
      style={position}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Hide debug info"
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full text-lime-300"
      >
        <X className="size-4" />
      </button>
      <label className="flex items-center gap-1">
        provider:
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
          className="rounded bg-black/60 text-lime-300"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {provider === 'mock' && (
        <label className="flex items-center gap-1">
          scenario:
          <select
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value as MockScenario)}
            className="rounded bg-black/60 text-lime-300"
          >
            {MOCK_SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        answers: {metrics.ok} ok / {metrics.invalid} invalid / {metrics.truncated} cut off, {metrics.dropped} dropped
      </div>
      {metrics.firstElementMs !== null && (
        <div className={metrics.firstElementMs <= FIRST_ELEMENT_TARGET_MS ? '' : 'text-red-400'}>
          first overlay: {metrics.firstElementMs.toFixed(0)} ms, total {metrics.totalMs?.toFixed(0)} ms
        </div>
      )}
      {metrics.serverFirstTokenMs !== null && (
        <div>
          server: first token {metrics.serverFirstTokenMs.toFixed(0)} ms, first element{' '}
          {metrics.serverFirstElementMs?.toFixed(0) ?? '–'} ms
        </div>
      )}
      <div>status: {status}</div>
      <button type="button" onClick={copyMetrics} className="my-1 rounded bg-lime-300/20 px-2 py-0.5">
        {copyState === 'copied' ? 'copied ✓' : copyState === 'failed' ? 'copy failed (see console)' : 'copy metrics'}
      </button>
      <div>
        viewport: {viewport.width}×{viewport.height}
      </div>
      <div>
        video: {videoSize ? `${videoSize.width}×${videoSize.height}` : '—'}
      </div>
      {frame && (
        <>
          <div className={frame.captureMs < 100 ? '' : 'text-red-400'}>capture: {frame.captureMs.toFixed(1)} ms</div>
          <div>
            frame: {frame.width}×{frame.height} {frame.mimeType} {(frame.blob.size / 1024).toFixed(1)} KB
          </div>
          <div>
            crop: {round(frame.crop.sx)},{round(frame.crop.sy)} {round(frame.crop.sw)}×{round(frame.crop.sh)}
          </div>
          <div>
            content%: {round(frame.contentRect.x)},{round(frame.contentRect.y)} {round(frame.contentRect.width)}×
            {round(frame.contentRect.height)}
          </div>
          <a href={frame.previewUrl} download={`frame-${frame.capturedAt}`} className="mt-1 block w-24">
            <img src={frame.previewUrl} alt="Captured model frame" className="w-24 border border-lime-300/50" />
          </a>
        </>
      )}
    </div>
  )
}
