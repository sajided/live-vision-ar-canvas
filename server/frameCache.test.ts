import { describe, expect, it } from 'vitest'
import { FrameCache } from './frameCache.js'

const bytes = (n: number) => new Uint8Array(n)

describe('FrameCache', () => {
  it('stores and returns frames until they expire', () => {
    let now = 0
    const cache = new FrameCache({ ttlMs: 1000, maxEntries: 10, maxBytes: 1e6, now: () => now })
    const id = cache.put(bytes(10), 'image/webp')
    expect(cache.get(id)?.mimeType).toBe('image/webp')
    now = 999
    expect(cache.get(id)).toBeDefined()
    now = 1000
    expect(cache.get(id)).toBeUndefined()
    expect(cache.size).toBe(0)
  })

  it('evicts the oldest frames past the entry or byte limits', () => {
    const cache = new FrameCache({ ttlMs: 1e6, maxEntries: 2, maxBytes: 25 })
    const a = cache.put(bytes(10), 'image/webp')
    const b = cache.put(bytes(10), 'image/webp')
    const c = cache.put(bytes(10), 'image/webp')
    expect(cache.get(a)).toBeUndefined()
    expect(cache.get(b)).toBeDefined()
    expect(cache.get(c)).toBeDefined()
    const d = cache.put(bytes(20), 'image/webp')
    expect(cache.get(b)).toBeUndefined()
    expect(cache.get(c)).toBeUndefined()
    expect(cache.get(d)).toBeDefined()
  })

  it('prunes expired frames on insert', () => {
    let now = 0
    const cache = new FrameCache({ ttlMs: 10, maxEntries: 10, maxBytes: 1e6, now: () => now })
    cache.put(bytes(1), 'image/webp')
    now = 20
    cache.put(bytes(1), 'image/webp')
    expect(cache.size).toBe(1)
  })
})
