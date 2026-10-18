import { randomUUID } from 'node:crypto'

export interface CachedFrame {
  bytes: Uint8Array
  mimeType: string
  expiresAt: number
}

interface FrameCacheOptions {
  ttlMs: number
  maxEntries: number
  maxBytes: number
  now?: () => number
}

/**
 * Short-lived, in-memory store for frames uploaded at capture time, so the
 * question request (and follow-ups) only send text. Never touches disk.
 */
export class FrameCache {
  private frames = new Map<string, CachedFrame>()
  private bytes = 0
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly maxBytes: number
  private readonly now: () => number

  constructor({ ttlMs, maxEntries, maxBytes, now = Date.now }: FrameCacheOptions) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
    this.now = now
  }

  put(bytes: Uint8Array, mimeType: string): string {
    this.prune()
    const id = randomUUID()
    this.frames.set(id, { bytes, mimeType, expiresAt: this.now() + this.ttlMs })
    this.bytes += bytes.length
    // Evict oldest first (Map keeps insertion order) until within limits.
    for (const [oldId, frame] of this.frames) {
      if (this.frames.size <= this.maxEntries && this.bytes <= this.maxBytes) break
      if (oldId === id) break
      this.delete(oldId, frame)
    }
    return id
  }

  get(id: string): CachedFrame | undefined {
    const frame = this.frames.get(id)
    if (!frame) return undefined
    if (frame.expiresAt <= this.now()) {
      this.delete(id, frame)
      return undefined
    }
    return frame
  }

  get size(): number {
    return this.frames.size
  }

  private prune() {
    const now = this.now()
    for (const [id, frame] of this.frames) if (frame.expiresAt <= now) this.delete(id, frame)
  }

  private delete(id: string, frame: CachedFrame) {
    this.frames.delete(id)
    this.bytes -= frame.bytes.length
  }
}
