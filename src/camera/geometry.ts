/**
 * Pure geometry for mapping between the on-screen viewfinder and the
 * normalized square frame sent to the model. No DOM access here.
 *
 * Coordinate conventions:
 * - "Source" rects are in raw video pixels.
 * - "Pct" values are normalized 0–100, matching the PRD's AR schema grid.
 */

export interface Size {
  width: number
  height: number
}

/** Region of the video's intrinsic frame, in video pixels. */
export interface SourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/** Placement of an image inside a destination canvas, in canvas pixels. */
export interface DestRect {
  dx: number
  dy: number
  dw: number
  dh: number
}

export interface PctPoint {
  x: number
  y: number
}

export interface PctRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The part of the video that `object-fit: cover` actually shows inside a
 * view of the given size: scaled to cover, then center-cropped.
 */
export function computeCoverCrop(video: Size, view: Size): SourceRect {
  const scale = Math.max(view.width / video.width, view.height / video.height)
  const sw = Math.min(video.width, view.width / scale)
  const sh = Math.min(video.height, view.height / scale)
  return {
    sx: (video.width - sw) / 2,
    sy: (video.height - sh) / 2,
    sw,
    sh,
  }
}

/**
 * Fit an image inside a `size`×`size` square without distortion, centered,
 * leaving letterbox bars on the short axis.
 */
export function fitIntoSquare(image: Size, size: number): DestRect {
  const scale = size / Math.max(image.width, image.height)
  const dw = image.width * scale
  const dh = image.height * scale
  return { dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh }
}

/** Where the content sits inside the square, as 0–100 percentages. */
export function contentRectPct(dest: DestRect, size: number): PctRect {
  return {
    x: (dest.dx / size) * 100,
    y: (dest.dy / size) * 100,
    width: (dest.dw / size) * 100,
    height: (dest.dh / size) * 100,
  }
}

/**
 * Map a point on the square model image (0–100) to the viewport (0–100).
 * Points that land in the letterbox bars map outside 0–100.
 */
export function imageToViewport(point: PctPoint, content: PctRect): PctPoint {
  return {
    x: ((point.x - content.x) / content.width) * 100,
    y: ((point.y - content.y) / content.height) * 100,
  }
}

/** Inverse of {@link imageToViewport}. */
export function viewportToImage(point: PctPoint, content: PctRect): PctPoint {
  return {
    x: content.x + (point.x / 100) * content.width,
    y: content.y + (point.y / 100) * content.height,
  }
}
