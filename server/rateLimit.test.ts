import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rateLimit.js'

describe('RateLimiter', () => {
  it('allows a burst, then reports the wait, then refills', () => {
    let now = 0
    const limiter = new RateLimiter({ capacity: 3, perMinute: 6, now: () => now })
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([0, 0, 0])
    expect(limiter.take('a')).toBe(10) // one token per 10 s
    now = 10_000
    expect(limiter.take('a')).toBe(0)
  })

  it('tracks keys independently', () => {
    const limiter = new RateLimiter({ capacity: 1, perMinute: 1 })
    expect(limiter.take('a')).toBe(0)
    expect(limiter.take('b')).toBe(0)
    expect(limiter.take('a')).toBeGreaterThan(0)
  })
})
