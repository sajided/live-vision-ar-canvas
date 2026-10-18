import { describe, expect, it } from 'vitest'
import { isRetryableUpstream, retryBeforeFirstChunk, upstreamErrorEvent } from './upstream.js'

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status })

async function collect<T>(source: AsyncIterable<T>) {
  const out: T[] = []
  for await (const x of source) out.push(x)
  return out
}

describe('upstream errors', () => {
  it('classifies statuses', () => {
    expect(isRetryableUpstream(httpError(429))).toBe(true)
    expect(isRetryableUpstream(httpError(503))).toBe(true)
    expect(isRetryableUpstream(httpError(400))).toBe(false)
    expect(isRetryableUpstream(new Error('socket hang up'))).toBe(true)
    expect(upstreamErrorEvent(httpError(429))).toMatchObject({ code: 'busy', retryable: true })
    expect(upstreamErrorEvent(httpError(400))).toMatchObject({ code: 'upstream', retryable: false })
  })
})

describe('retryBeforeFirstChunk', () => {
  it('retries a failure that happens before any output', async () => {
    let calls = 0
    const factory = async function* () {
      calls++
      if (calls === 1) throw httpError(503)
      yield 'ok'
    }
    expect(await collect(retryBeforeFirstChunk(factory, { retries: 1, delayMs: 0 }))).toEqual(['ok'])
    expect(calls).toBe(2)
  })

  it('does not retry once output has started', async () => {
    let calls = 0
    const factory = async function* () {
      calls++
      yield 'partial'
      throw httpError(503)
    }
    await expect(collect(retryBeforeFirstChunk(factory, { retries: 1, delayMs: 0 }))).rejects.toThrow('HTTP 503')
    expect(calls).toBe(1)
  })

  it('does not retry client errors and gives up after the retry budget', async () => {
    let calls = 0
    const bad = async function* (): AsyncGenerator<string> {
      calls++
      yield* []
      throw httpError(400)
    }
    await expect(collect(retryBeforeFirstChunk(bad, { retries: 1, delayMs: 0 }))).rejects.toThrow()
    expect(calls).toBe(1)

    calls = 0
    const down = async function* (): AsyncGenerator<string> {
      calls++
      yield* []
      throw httpError(503)
    }
    await expect(collect(retryBeforeFirstChunk(down, { retries: 1, delayMs: 0 }))).rejects.toThrow()
    expect(calls).toBe(2)
  })
})
