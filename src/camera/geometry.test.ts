import { describe, expect, it } from 'vitest'
import {
  computeCoverCrop,
  contentRectPct,
  fitIntoSquare,
  imageToViewport,
  viewportToImage,
} from './geometry'

describe('computeCoverCrop', () => {
  it('crops the sides of a landscape video shown in a portrait view', () => {
    // 1920x1080 video in a 390x844 phone viewport: height is the limiting axis.
    const crop = computeCoverCrop({ width: 1920, height: 1080 }, { width: 390, height: 844 })
    expect(crop.sh).toBeCloseTo(1080)
    expect(crop.sw).toBeCloseTo(1080 * (390 / 844))
    expect(crop.sx).toBeCloseTo((1920 - crop.sw) / 2)
    expect(crop.sy).toBeCloseTo(0)
  })

  it('crops top and bottom of a 4:3 video shown in a 16:9 view', () => {
    const crop = computeCoverCrop({ width: 1440, height: 1080 }, { width: 1600, height: 900 })
    expect(crop.sw).toBeCloseTo(1440)
    expect(crop.sh).toBeCloseTo(810)
    expect(crop.sx).toBeCloseTo(0)
    expect(crop.sy).toBeCloseTo(135)
  })

  it('returns the full frame when aspect ratios match', () => {
    const crop = computeCoverCrop({ width: 1280, height: 720 }, { width: 640, height: 360 })
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 })
  })

  it('preserves the view aspect ratio', () => {
    const view = { width: 820, height: 1180 }
    const crop = computeCoverCrop({ width: 1080, height: 1920 }, view)
    expect(crop.sw / crop.sh).toBeCloseTo(view.width / view.height)
  })
})

describe('fitIntoSquare', () => {
  it('letterboxes a portrait image horizontally', () => {
    const dest = fitIntoSquare({ width: 500, height: 1000 }, 768)
    expect(dest).toEqual({ dx: 192, dy: 0, dw: 384, dh: 768 })
  })

  it('letterboxes a landscape image vertically', () => {
    const dest = fitIntoSquare({ width: 1600, height: 900 }, 768)
    expect(dest.dw).toBeCloseTo(768)
    expect(dest.dh).toBeCloseTo(432)
    expect(dest.dx).toBeCloseTo(0)
    expect(dest.dy).toBeCloseTo(168)
  })

  it('fills a square image exactly', () => {
    expect(fitIntoSquare({ width: 1080, height: 1080 }, 768)).toEqual({ dx: 0, dy: 0, dw: 768, dh: 768 })
  })
})

describe('viewport <-> image mapping', () => {
  const content = contentRectPct(fitIntoSquare({ width: 390, height: 844 }, 768), 768)

  it('maps viewport corners onto the content rect edges', () => {
    expect(viewportToImage({ x: 0, y: 0 }, content)).toEqual({ x: content.x, y: content.y })
    const br = viewportToImage({ x: 100, y: 100 }, content)
    expect(br.x).toBeCloseTo(content.x + content.width)
    expect(br.y).toBeCloseTo(content.y + content.height)
  })

  it('round-trips points', () => {
    for (const p of [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 12.5, y: 87.3 },
      { x: 100, y: 100 },
    ]) {
      const back = imageToViewport(viewportToImage(p, content), content)
      expect(back.x).toBeCloseTo(p.x)
      expect(back.y).toBeCloseTo(p.y)
    }
  })

  it('maps letterbox points outside the viewport', () => {
    expect(imageToViewport({ x: 0, y: 50 }, content).x).toBeLessThan(0)
  })
})
