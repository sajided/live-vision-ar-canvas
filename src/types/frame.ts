import type { PctRect, Size, SourceRect } from '../camera/geometry'

export interface CapturedFrame {
  /** Encoded square frame for the model. */
  blob: Blob
  mimeType: string
  /** Pixel size of the encoded frame (always square). */
  width: number
  height: number
  /** Where the visible viewport sits inside the square, 0–100. */
  contentRect: PctRect
  /** Region of the raw video that was on screen, in video pixels. */
  crop: SourceRect
  /** Intrinsic video resolution at capture time. */
  videoSize: Size
  /** CSS pixel size of the viewfinder at capture time. */
  viewport: Size
  /** Visible crop at native resolution, shown while frozen. */
  still: HTMLCanvasElement
  /** Object URL for `blob`; revoke when the frame is discarded. */
  previewUrl: string
  /** Time spent drawing and encoding the model frame. */
  captureMs: number
  capturedAt: number
}
