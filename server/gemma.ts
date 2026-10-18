import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from '@google/genai'
import type { PctRect } from '../src/camera/geometry'
import { env } from './env'
import { buildSystemInstruction, buildUserPrompt } from './prompt'

let client: GoogleGenAI | null = null
const ai = () => (client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }))
export const geminiConfigured = () => Boolean(env.GEMINI_API_KEY)
const systemInstruction = buildSystemInstruction(env.PROMPT_VARIANT)

/** Filled in while streaming, for timings and truncation detection. */
export interface GemmaMeta {
  firstTokenAt?: number
  finishReason?: string
}

export interface GemmaRequest {
  image: Uint8Array
  mimeType: string
  query: string
  contentRect: PctRect
  signal?: AbortSignal
  /** Overrides env.GEMMA_JSON_MODE (used by the probe script). */
  jsonMode?: boolean
  meta?: GemmaMeta
}

/** Stream raw answer text from Gemma for one annotated-frame request. */
export async function* streamGemma(req: GemmaRequest): AsyncIterable<string> {
  const config: GenerateContentConfig = {
    systemInstruction,
    temperature: 0.2,
    // Step-by-step math with diagrams needs more room than plain callouts.
    maxOutputTokens: 2048,
    // Minimal thinking roughly halves time to first token versus the default.
    thinkingConfig: { thinkingLevel: ThinkingLevel[env.GEMMA_THINKING_LEVEL] },
    abortSignal: req.signal,
  }
  if (req.jsonMode ?? env.GEMMA_JSON_MODE) config.responseMimeType = 'application/json'

  const stream = await ai().models.generateContentStream({
    model: env.GEMMA_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: req.mimeType, data: Buffer.from(req.image).toString('base64') } },
          { text: buildUserPrompt(req.query, req.contentRect) },
        ],
      },
    ],
    config,
  })

  for await (const chunk of stream) {
    const candidate = chunk.candidates?.[0]
    if (candidate?.finishReason && req.meta) req.meta.finishReason = candidate.finishReason
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text && !part.thought) {
        if (req.meta) req.meta.firstTokenAt ??= performance.now()
        yield part.text
      }
    }
  }
}

/** One tiny call at boot so the first real request doesn't pay for TLS and routing setup. */
export async function warmUp(): Promise<void> {
  const start = performance.now()
  try {
    await ai().models.generateContent({
      model: env.GEMMA_MODEL,
      contents: 'Reply with OK.',
      config: { maxOutputTokens: 4, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },
    })
    console.info(`[gemma] warm-up done in ${(performance.now() - start).toFixed(0)} ms`)
  } catch (err) {
    console.warn('[gemma] warm-up failed:', err instanceof Error ? err.message : err)
  }
}
