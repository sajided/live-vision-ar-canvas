/**
 * Frame quality scoring for freeze stabilization: variance of the Laplacian
 * (a standard focus/motion-blur measure) and mean brightness, computed on a
 * small grayscale copy so it costs a few milliseconds per frame.
 */

export interface FrameQuality {
  /** Laplacian variance; higher is sharper. */
  sharpness: number
  /** Mean luma, 0–255. */
  brightness: number
}

/** Below these the frame is likely too blurry or dark to read; tune on device. */
export const BLURRY_BELOW = 60
export const DARK_BELOW = 40

/** Rec. 601 luma from RGBA pixels. */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return gray
}

export function frameQuality(gray: Float32Array, width: number, height: number): FrameQuality {
  let sum = 0
  for (const v of gray) sum += v
  let lapSum = 0
  let lapSqSum = 0
  let n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
      lapSum += lap
      lapSqSum += lap * lap
      n++
    }
  }
  const mean = n ? lapSum / n : 0
  return { sharpness: n ? lapSqSum / n - mean * mean : 0, brightness: gray.length ? sum / gray.length : 0 }
}

export function describeQuality({ sharpness, brightness }: FrameQuality): string | null {
  if (brightness < DARK_BELOW) return 'The photo is quite dark — more light will help.'
  if (sharpness < BLURRY_BELOW) return 'The photo looks blurry — hold steady and retake.'
  return null
}
