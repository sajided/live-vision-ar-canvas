import type { CapturedFrame } from '../types/frame'
import { computeCoverCrop, contentRectPct, fitIntoSquare } from './geometry'

export const FRAME_SIZE = 768
const QUALITY = 0.8
// Caps the freeze-frame canvas to keep memory sane on iOS.
const STILL_MAX_EDGE = 2048

type Surface = HTMLCanvasElement | OffscreenCanvas
type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

let frameSurface: Surface | null = null
let webpSupported: boolean | null = null

function createSurface(width: number, height: number): Surface {
  // iOS 15 has no 2D OffscreenCanvas; fall back to a detached <canvas>.
  if (typeof OffscreenCanvas !== 'undefined') {
    const surface = new OffscreenCanvas(width, height)
    if (surface.getContext('2d')) return surface
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function get2d(surface: Surface): Context2D {
  const ctx = surface.getContext('2d') as Context2D | null
  if (!ctx) throw new Error('2D canvas context unavailable')
  return ctx
}

// Safari can't encode WebP and silently returns PNG (slow, large), so probe once.
function preferredMimeType(): string {
  if (webpSupported === null) {
    const probe = document.createElement('canvas')
    probe.width = probe.height = 1
    webpSupported = probe.toDataURL('image/webp').startsWith('data:image/webp')
  }
  return webpSupported ? 'image/webp' : 'image/jpeg'
}

function encode(surface: Surface, type: string): Promise<Blob> {
  if (surface instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) =>
      surface.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Frame encoding failed'))), type, QUALITY),
    )
  }
  return surface.convertToBlob({ type, quality: QUALITY })
}

/**
 * Snapshot exactly what the viewfinder shows (the object-fit: cover crop),
 * letterboxed into a FRAME_SIZE square for the model.
 */
/** What the viewfinder shows: the live camera, or an image in still-image mode. */
export type FrameSource = HTMLVideoElement | HTMLImageElement

export function intrinsicSize(source: FrameSource): { width: number; height: number } {
  return source instanceof HTMLVideoElement
    ? { width: source.videoWidth, height: source.videoHeight }
    : { width: source.naturalWidth, height: source.naturalHeight }
}

interface CaptureOptions {
  /** Pixels to use instead of the source's current frame (same intrinsic size), e.g. the sharpest of a burst. */
  pixels?: CanvasImageSource
}

export async function captureFrame(source: FrameSource, { pixels }: CaptureOptions = {}): Promise<CapturedFrame> {
  const video = pixels ?? source
  const videoSize = intrinsicSize(source)
  const viewport = { width: source.clientWidth, height: source.clientHeight }
  if (!videoSize.width || !videoSize.height || !viewport.width || !viewport.height) {
    throw new Error('Camera is not ready yet')
  }

  const crop = computeCoverCrop(videoSize, viewport)
  const dest = fitIntoSquare({ width: crop.sw, height: crop.sh }, FRAME_SIZE)

  const start = performance.now()
  frameSurface ??= createSurface(FRAME_SIZE, FRAME_SIZE)
  const ctx = get2d(frameSurface)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, FRAME_SIZE, FRAME_SIZE)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, dest.dx, dest.dy, dest.dw, dest.dh)
  const blob = await encode(frameSurface, preferredMimeType())
  const captureMs = performance.now() - start

  return {
    blob,
    mimeType: blob.type,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    contentRect: contentRectPct(dest, FRAME_SIZE),
    crop,
    videoSize,
    viewport,
    still: drawStill(video, crop),
    previewUrl: URL.createObjectURL(blob),
    captureMs,
    capturedAt: Date.now(),
  }
}

function drawStill(video: CanvasImageSource, crop: CapturedFrame['crop']): HTMLCanvasElement {
  const scale = Math.min(1, STILL_MAX_EDGE / Math.max(crop.sw, crop.sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(crop.sw * scale)
  canvas.height = Math.round(crop.sh * scale)
  canvas.className = 'h-full w-full object-cover'
  get2d(canvas).drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height)
  return canvas
}
