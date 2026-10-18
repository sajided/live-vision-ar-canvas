import { env } from './env.js'

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
export const MAX_SPEECH_CHARS = 300

/** Small LRU of synthesized audio so replays and retries aren't billed twice. */
export class AudioCache {
  private entries = new Map<string, Uint8Array>()
  private bytes = 0
  private readonly maxEntries: number
  private readonly maxBytes: number

  constructor(maxEntries: number, maxBytes: number) {
    this.maxEntries = maxEntries
    this.maxBytes = maxBytes
  }

  get(key: string): Uint8Array | undefined {
    const value = this.entries.get(key)
    if (value) {
      // Refresh recency.
      this.entries.delete(key)
      this.entries.set(key, value)
    }
    return value
  }

  set(key: string, value: Uint8Array) {
    const old = this.entries.get(key)
    if (old) {
      this.bytes -= old.length
      this.entries.delete(key)
    }
    this.entries.set(key, value)
    this.bytes += value.length
    for (const [k, v] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) break
      this.entries.delete(k)
      this.bytes -= v.length
    }
  }

  get size() {
    return this.entries.size
  }
}

const cache = new AudioCache(300, 40 * 1024 * 1024)

export const ttsEnabled = () => Boolean(env.ELEVENLABS_API_KEY)

export class SpeechError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Speak `text` with ElevenLabs as an MP3 stream. Cached audio is returned
 * whole; fresh audio streams to the caller while being collected for the cache.
 */
export async function synthesize(text: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array> | Uint8Array> {
  const key = `${env.ELEVENLABS_VOICE_ID}:${env.ELEVENLABS_MODEL}:${text}`
  const cached = cache.get(key)
  if (cached) return cached

  const url = `${ELEVENLABS_URL}/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}/stream?output_format=mp3_44100_64`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY ?? '', 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env.ELEVENLABS_MODEL,
      // A calm, steady teaching voice.
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, speed: 0.95 },
    }),
    signal,
  })
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new SpeechError(response.status, `ElevenLabs ${response.status}: ${detail.slice(0, 200)}`)
  }

  const chunks: Uint8Array[] = []
  const collect = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      chunks.push(chunk)
      controller.enqueue(chunk)
    },
    flush() {
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const audio = new Uint8Array(total)
      let offset = 0
      for (const c of chunks) {
        audio.set(c, offset)
        offset += c.length
      }
      cache.set(key, audio)
    },
  })
  return response.body.pipeThrough(collect)
}
