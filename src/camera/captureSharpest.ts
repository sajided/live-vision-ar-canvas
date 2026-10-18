import { intrinsicSize, type FrameSource } from './captureFrame'
import { frameQuality, toGray, type FrameQuality } from './sharpness'

const SCORE_EDGE = 128
const BURST_FRAMES = 4
/** Fallback spacing where requestVideoFrameCallback is missing (≈ one 30 fps frame). */
const FRAME_INTERVAL_MS = 34

export interface SharpestFrame {
  /** Full-resolution copy of the chosen frame. */
  pixels: HTMLCanvasElement
  quality: FrameQuality
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number
}

function nextFrame(video: HTMLVideoElement): Promise<void> {
  const v = video as VideoWithFrameCallback
  return new Promise((resolve) => {
    if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => resolve())
    else setTimeout(resolve, FRAME_INTERVAL_MS)
  })
}

const scoreCanvas = document.createElement('canvas')

function score(source: CanvasImageSource, width: number, height: number): FrameQuality {
  const scale = SCORE_EDGE / Math.max(width, height)
  const w = Math.max(8, Math.round(width * scale))
  const h = Math.max(8, Math.round(height * scale))
  scoreCanvas.width = w
  scoreCanvas.height = h
  const ctx = scoreCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { sharpness: Infinity, brightness: 128 }
  ctx.drawImage(source, 0, 0, w, h)
  return frameQuality(toGray(ctx.getImageData(0, 0, w, h).data, w, h), w, h)
}

/**
 * Freeze stabilization: sample a short burst of camera frames (~130 ms) and
 * keep the sharpest, so a shaky tap doesn't freeze a motion-blurred frame.
 * Still images are scored once.
 */
export async function captureSharpest(source: FrameSource): Promise<SharpestFrame> {
  const { width, height } = intrinsicSize(source)
  const frames = source instanceof HTMLVideoElement ? BURST_FRAMES : 1
  const pixels = document.createElement('canvas')
  pixels.width = width
  pixels.height = height
  let bestQuality: FrameQuality | null = null
  for (let i = 0; i < frames; i++) {
    if (i > 0 && source instanceof HTMLVideoElement) await nextFrame(source)
    const quality = score(source, width, height)
    if (!bestQuality || quality.sharpness > bestQuality.sharpness) {
      pixels.getContext('2d')?.drawImage(source, 0, 0, width, height)
      bestQuality = quality
    }
  }
  return { pixels, quality: bestQuality ?? { sharpness: Infinity, brightness: 128 } }
}
