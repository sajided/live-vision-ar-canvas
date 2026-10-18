import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  // Optional at load so a deployment without it still answers /api/health and explains what's missing.
  GEMINI_API_KEY: z.string().optional(),
  GEMMA_MODEL: z.string().default('gemma-4-26b-a4b-it'),
  // JSON mime type only: Gemma rejects responseJsonSchema with a 400.
  GEMMA_JSON_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  GEMMA_THINKING_LEVEL: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).default('MINIMAL'),
  GEMMA_WARMUP: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Text-to-speech for the tutor voice; without a key the browser's built-in voice is used.
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('JBFqnCBsd6RMkjVDRZzb'),
  ELEVENLABS_MODEL: z.string().default('eleven_flash_v2_5'),
  PROMPT_VARIANT: z.enum(['full', 'compact']).default('full'),
  PORT: z.coerce.number().int().default(8787),
})

export const env = EnvSchema.parse(process.env)
