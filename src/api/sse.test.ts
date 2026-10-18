import { describe, expect, it } from 'vitest'
import { readSSE } from './sse'

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out = []
  for await (const message of readSSE(stream)) out.push(message)
  return out
}

describe('readSSE', () => {
  it('parses events split across chunks', async () => {
    const messages = await collect(streamOf('event: elem', 'ent\ndata: {"a"', ':1}\n\nevent: done\ndata: {}\n\n'))
    expect(messages).toEqual([
      { event: 'element', data: '{"a":1}' },
      { event: 'done', data: '{}' },
    ])
  })

  it('joins multi-line data, ignores comments and handles CRLF', async () => {
    const messages = await collect(streamOf(': keepalive\r\n\r\ndata: one\r\ndata: two\r\n\r\n'))
    expect(messages).toEqual([{ event: 'message', data: 'one\ntwo' }])
  })

  it('flushes a final event without a trailing blank line', async () => {
    expect(await collect(streamOf('event: done\ndata: {}'))).toEqual([{ event: 'done', data: '{}' }])
  })
})
