/**
 * Live check of what the configured Gemma model supports through the Gemini
 * API: streaming, and JSON mode with a response schema.
 *
 *   pnpm gemma:probe [path/to/image.jpg] [question]
 */
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { annotateStream } from '../annotate'
import { env } from '../env'
import { streamGemma } from '../gemma'

const [imagePath, query = 'What is this? Point out the key parts.'] = process.argv.slice(2)

async function run(jsonMode: boolean, image: Uint8Array, mimeType: string) {
  const label = `jsonMode=${jsonMode}`
  const start = performance.now()
  const chunkTimes: number[] = []
  let text = ''
  try {
    for await (const chunk of streamGemma({ image, mimeType, query, contentRect: { x: 0, y: 0, width: 100, height: 100 }, jsonMode })) {
      chunkTimes.push(performance.now() - start)
      text += chunk
    }
  } catch (err) {
    console.log(`\n[${label}] FAILED: ${err instanceof Error ? err.message : String(err)}`)
    return
  }
  const total = performance.now() - start
  // Re-run the text through the real pipeline (repair, grid rescale, validation).
  let outcome = ''
  for await (const event of annotateStream((async function* () {
    yield text
  })())) {
    if (event.type === 'done') outcome = `valid=${event.stats.valid} dropped=${event.stats.dropped}`
    else if (event.type === 'error') outcome = `error=${event.code}`
  }
  console.log(`\n[${label}] chunks=${chunkTimes.length} first=${chunkTimes[0]?.toFixed(0)}ms total=${total.toFixed(0)}ms`)
  console.log(`[${label}] ${outcome}`)
  console.log(`[${label}] raw:\n${text}`)
}

async function main() {
  if (!imagePath) {
    console.error('Usage: pnpm gemma:probe <image.jpg|png|webp> [question]')
    process.exit(1)
  }
  const ext = extname(imagePath).slice(1).toLowerCase()
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const image = new Uint8Array(await readFile(imagePath))
  console.log(`model=${env.GEMMA_MODEL} image=${imagePath} (${(image.length / 1024).toFixed(0)} KB)`)
  await run(false, image, mimeType)
  await run(true, image, mimeType)
}

void main()
