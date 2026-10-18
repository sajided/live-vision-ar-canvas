import { describe, expect, it } from 'vitest'
import { AudioCache } from './speech'

const bytes = (n: number) => new Uint8Array(n)

describe('AudioCache', () => {
  it('evicts least recently used entries past its limits', () => {
    const cache = new AudioCache(2, 1000)
    cache.set('a', bytes(1))
    cache.set('b', bytes(1))
    cache.get('a') // a is now most recent
    cache.set('c', bytes(1))
    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBeDefined()
  })

  it('respects the byte budget and replaces existing keys', () => {
    const cache = new AudioCache(10, 10)
    cache.set('a', bytes(6))
    cache.set('a', bytes(4))
    cache.set('b', bytes(6))
    expect(cache.size).toBe(2)
    cache.set('c', bytes(6))
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBeDefined()
  })
})
