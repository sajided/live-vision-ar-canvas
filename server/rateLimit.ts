interface Bucket {
  tokens: number
  updatedAt: number
}

interface RateLimiterOptions {
  /** Burst size. */
  capacity: number
  /** Tokens added per minute. */
  perMinute: number
  now?: () => number
}

/** Per-key token bucket. `take` returns 0 when allowed, else seconds until the next token. */
export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private readonly capacity: number
  private readonly ratePerMs: number
  private readonly now: () => number

  constructor({ capacity, perMinute, now = Date.now }: RateLimiterOptions) {
    this.capacity = capacity
    this.ratePerMs = perMinute / 60_000
    this.now = now
  }

  take(key: string): number {
    const now = this.now()
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updatedAt) * this.ratePerMs)
    bucket.updatedAt = now
    this.buckets.set(key, bucket)
    if (this.buckets.size > 10_000) this.sweep(now)

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return 0
    }
    return Math.ceil((1 - bucket.tokens) / this.ratePerMs / 1000)
  }

  /** Drop buckets that have refilled completely; they behave like new ones. */
  private sweep(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.tokens + (now - bucket.updatedAt) * this.ratePerMs >= this.capacity) this.buckets.delete(key)
    }
  }
}
