import { describe, expect, it } from 'vitest'
import { computeCoverCrop, contentRectPct, fitIntoSquare, viewportToImage } from '../camera/geometry'
import { frameToScreen } from './project'

const portrait = { width: 390, height: 844 }
const still = { width: 1080 * (390 / 844), height: 1080 }
const content = contentRectPct(fitIntoSquare(still, 768), 768)

describe('frameToScreen', () => {
  it('maps the content rect corners to the screen corners', () => {
    const tl = frameToScreen({ x: content.x, y: content.y }, content, still, portrait)
    const br = frameToScreen({ x: content.x + content.width, y: content.y + content.height }, content, still, portrait)
    expect(tl.x).toBeCloseTo(0)
    expect(tl.y).toBeCloseTo(0)
    expect(br.x).toBeCloseTo(portrait.width)
    expect(br.y).toBeCloseTo(portrait.height)
  })

  it('accounts for the letterbox offset', () => {
    // Image x=50 is the center of the square, which is the center of the content.
    const center = frameToScreen({ x: 50, y: 50 }, content, still, portrait)
    expect(center.x).toBeCloseTo(portrait.width / 2)
    expect(center.y).toBeCloseTo(portrait.height / 2)
    // The left letterbox edge lands off-screen.
    expect(frameToScreen({ x: 0, y: 50 }, content, still, portrait).x).toBeLessThan(0)
  })

  it('tracks the cover-cropped still after rotating to landscape', () => {
    const landscape = { width: 844, height: 390 }
    const crop = computeCoverCrop(still, landscape)
    // A point at the vertical center of the original viewport stays centered.
    const center = frameToScreen(viewportToImage({ x: 50, y: 50 }, content), content, still, landscape)
    expect(center.x).toBeCloseTo(landscape.width / 2)
    expect(center.y).toBeCloseTo(landscape.height / 2)
    // The top of the still visible after cropping maps to screen y=0.
    const visibleTop = viewportToImage({ x: 50, y: (crop.sy / still.height) * 100 }, content)
    expect(frameToScreen(visibleTop, content, still, landscape).y).toBeCloseTo(0)
  })
})
