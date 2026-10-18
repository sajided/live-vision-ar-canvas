import { computeCoverCrop, imageToViewport, type PctPoint, type PctRect, type Size } from '../camera/geometry'

export interface PxPoint {
  x: number
  y: number
}

/**
 * Project a point on the square model image (0–100) to screen pixels.
 *
 * The frozen still is shown with object-fit: cover, so this stays correct
 * even if the screen has resized or rotated since capture.
 */
export function frameToScreen(point: PctPoint, contentRect: PctRect, stillSize: Size, screen: Size): PxPoint {
  const view = imageToViewport(point, contentRect)
  const crop = computeCoverCrop(stillSize, screen)
  const stillX = (view.x / 100) * stillSize.width
  const stillY = (view.y / 100) * stillSize.height
  return {
    x: ((stillX - crop.sx) / crop.sw) * screen.width,
    y: ((stillY - crop.sy) / crop.sh) * screen.height,
  }
}
