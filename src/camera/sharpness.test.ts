import { describe, expect, it } from 'vitest'
import { describeQuality, frameQuality, toGray } from './sharpness'

const SIZE = 32

function image(fn: (x: number, y: number) => number): Float32Array {
  const gray = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) gray[y * SIZE + x] = fn(x, y)
  return gray
}

describe('frameQuality', () => {
  it('scores crisp edges above soft gradients above flat images', () => {
    const crisp = frameQuality(image((x) => (Math.floor(x / 4) % 2 ? 255 : 0)), SIZE, SIZE)
    const soft = frameQuality(image((x) => 128 + 60 * Math.sin(x / 3)), SIZE, SIZE)
    const flat = frameQuality(image(() => 128), SIZE, SIZE)
    expect(crisp.sharpness).toBeGreaterThan(soft.sharpness)
    expect(soft.sharpness).toBeGreaterThan(flat.sharpness)
    expect(flat.sharpness).toBe(0)
  })

  it('measures brightness', () => {
    expect(frameQuality(image(() => 200), SIZE, SIZE).brightness).toBeCloseTo(200)
  })

  it('converts RGBA to luma', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255])
    expect(Array.from(toGray(rgba, 2, 1))).toEqual([255, 0])
  })

  it('describes dark and blurry frames', () => {
    expect(describeQuality({ sharpness: 500, brightness: 10 })).toMatch(/dark/)
    expect(describeQuality({ sharpness: 5, brightness: 150 })).toMatch(/blurry/)
    expect(describeQuality({ sharpness: 500, brightness: 150 })).toBeNull()
  })
})
