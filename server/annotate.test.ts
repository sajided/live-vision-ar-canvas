import { describe, expect, it } from 'vitest'
import type { AnnotationEvent } from '../src/ar/events'
import {
  annotateStream,
  fromModelGrid,
  invalidLatex,
  latexToPlainText,
  looksLikeProse,
  proseFormulaToCard,
  repairJsonEscapes,
  repairLatex,
  repairLatexFields,
} from './annotate'
import type { ARElement } from '../src/ar/schema'

async function* chunked(text: string, size = 9) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size)
}

async function collect(source: AsyncIterable<string>, signal?: AbortSignal) {
  const events: AnnotationEvent[] = []
  for await (const event of annotateStream(source, { signal })) events.push(event)
  return events
}

const beacon = (id: string, x = 500, y = 250) => ({ id, type: 'TargetBeacon', position: { x, y }, label: 'Pin' })

describe('fromModelGrid', () => {
  it('rescales 0–1000 points to 0–100', () => {
    expect(fromModelGrid({ type: 'ConnectorLine', from: { x: 0, y: 1000 }, to: { x: 123, y: 456 } })).toEqual({
      type: 'ConnectorLine',
      from: { x: 0, y: 100 },
      to: { x: 12.3, y: 45.6 },
    })
  })

  it('clamps small overshoots and leaves large ones for validation to reject', () => {
    expect(fromModelGrid(beacon('a', 1004, -3))).toMatchObject({ position: { x: 100, y: 0 } })
    expect(fromModelGrid(beacon('a', 1500, 0))).toMatchObject({ position: { x: 1500 } })
  })
})

describe('fromModelGrid (geometry)', () => {
  it('rescales point lists, centers, vertices and radii', () => {
    expect(fromModelGrid({ type: 'Polygon', points: [{ x: 100, y: 200 }, { x: 300, y: 400 }] })).toMatchObject({
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    })
    expect(fromModelGrid({ type: 'Circle', center: { x: 500, y: 500 }, radius: 250 })).toMatchObject({
      center: { x: 50, y: 50 },
      radius: 25,
    })
    expect(fromModelGrid({ type: 'Angle', vertex: { x: 0, y: 0 }, from: { x: 1000, y: 0 }, to: { x: 0, y: 1000 } })).toMatchObject({
      vertex: { x: 0, y: 0 },
      from: { x: 100, y: 0 },
      to: { x: 0, y: 100 },
    })
  })

  it('rescales nested diagram shapes', () => {
    const out = fromModelGrid({
      type: 'Diagram',
      position: { x: 500, y: 500 },
      shapes: [{ kind: 'polygon', points: [{ x: 50, y: 950 }] }, { kind: 'circle', center: { x: 500, y: 500 }, radius: 100 }],
    }) as { shapes: unknown[] }
    expect(out.shapes).toEqual([
      { kind: 'polygon', points: [{ x: 5, y: 95 }] },
      { kind: 'circle', center: { x: 50, y: 50 }, radius: 10 },
    ])
  })
})

describe('invalidLatex', () => {
  const formula = (latex: string): ARElement => ({ id: 'f', type: 'Formula', position: { x: 1, y: 1 }, latex })

  it('accepts valid LaTeX and rejects broken LaTeX', () => {
    expect(invalidLatex(formula('\\frac{a}{b} = \\sqrt{2}'))).toBeNull()
    expect(invalidLatex(formula('\\frac{a}{'))).toBe('\\frac{a}{')
  })

  it('rejects untrusted commands', () => {
    expect(invalidLatex(formula('\\href{javascript:alert(1)}{x}'))).not.toBeNull()
  })

  it('checks diagram labels and captions', () => {
    const diagram: ARElement = {
      id: 'd',
      type: 'Diagram',
      position: { x: 1, y: 1 },
      shapes: [{ kind: 'label', position: { x: 1, y: 1 }, latex: '\\badcommand', color: 'blue' }],
    }
    expect(invalidLatex(diagram)).toBe('\\badcommand')
  })
})

describe('annotateStream', () => {
  it('emits validated, rescaled elements then done', async () => {
    const events = await collect(chunked(JSON.stringify({ elements: [beacon('a'), beacon('b')], summary: 'Hi' })))
    expect(events.map((e) => e.type)).toEqual(['element', 'element', 'done'])
    expect(events[0]).toMatchObject({ element: { id: 'a', position: { x: 50, y: 25 }, color: 'blue' } })
    expect(events[2]).toMatchObject({ summary: 'Hi', stats: { valid: 2, dropped: 0 } })
  })

  it('flags cut-off answers and reports model timings', async () => {
    const cut = JSON.stringify({ elements: [beacon('a'), beacon('b')] }).slice(0, -12)
    const events = await collect(chunked(cut))
    expect(events.at(-1)).toMatchObject({ type: 'done', stats: { valid: 1, truncated: true } })

    const meta = { firstTokenAt: performance.now(), finishReason: 'MAX_TOKENS' }
    const done: AnnotationEvent[] = []
    for await (const e of annotateStream(chunked(JSON.stringify({ elements: [beacon('a')] })), { meta })) done.push(e)
    expect(done.at(-1)).toMatchObject({ stats: { truncated: true, finishReason: 'MAX_TOKENS' } })
    expect((done.at(-1) as { stats: { firstTokenMs: number } }).stats.firstTokenMs).toBeTypeOf('number')
  })

  it('maps upstream rate limits to a busy error', async () => {
    async function* limited(): AsyncGenerator<string> {
      yield* []
      throw Object.assign(new Error('quota'), { status: 429 })
    }
    expect(await collect(limited())).toEqual([expect.objectContaining({ type: 'error', code: 'busy', retryable: true })])
  })

  it('drops invalid elements and keeps the rest', async () => {
    const events = await collect(
      chunked(JSON.stringify({ elements: [beacon('a'), { id: 'x', type: 'Spotlight' }, beacon('c', 5000)] })),
    )
    expect(events.filter((e) => e.type === 'element')).toHaveLength(1)
    expect(events.at(-1)).toMatchObject({ type: 'done', stats: { valid: 1, dropped: 2 } })
  })

  it('drops elements whose LaTeX does not parse', async () => {
    const events = await collect(
      chunked(
        JSON.stringify({
          elements: [
            { id: 'ok', type: 'Formula', position: { x: 500, y: 500 }, latex: 'a^2 + b^2' },
            { id: 'bad', type: 'Formula', position: { x: 500, y: 500 }, latex: '\\frac{' },
          ],
        }),
      ),
    )
    expect(events.at(-1)).toMatchObject({ type: 'done', stats: { valid: 1, dropped: 1 } })
  })

  it('renames duplicate ids', async () => {
    const events = await collect(chunked(JSON.stringify({ elements: [beacon('a'), beacon('a'), beacon('a')] })))
    const ids = events.flatMap((e) => (e.type === 'element' ? [(e.element as { id: string }).id] : []))
    expect(ids).toEqual(['a', 'a-2', 'a-3'])
  })

  it('reports invalid when nothing usable came back', async () => {
    const events = await collect(chunked('I cannot help with that.'))
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'invalid', retryable: true })])
  })

  it('reports upstream failures', async () => {
    async function* failing(): AsyncGenerator<string> {
      yield '{"elements":['
      throw new Error('503')
    }
    const events = await collect(failing())
    expect(events).toEqual([expect.objectContaining({ type: 'error', code: 'upstream' })])
  })

  it('stays silent when the client aborts', async () => {
    const controller = new AbortController()
    async function* aborted(): AsyncGenerator<string> {
      controller.abort()
      yield* []
      throw new Error('aborted')
    }
    expect(await collect(aborted(), controller.signal)).toEqual([])
  })
})

describe('LaTeX repair', () => {
  it('doubles invalid JSON escapes so the element parses', () => {
    const json = '{"latex":"x = \\sqrt{4} \\cdot \\underline{y}","q":"\\"ok\\" \\\\frac \\u00e9"}'
    expect(() => JSON.parse(json)).toThrow()
    expect(JSON.parse(repairJsonEscapes(json))).toEqual({
      latex: 'x = \\sqrt{4} \\cdot \\underline{y}',
      q: '"ok" \\frac é',
    })
  })

  it('restores commands that collided with JSON escapes', () => {
    // "\text", "\frac", "\beta", "\right", "\neq" parsed from single-backslash JSON.
    const parsed = JSON.parse('"\\text{cm} \\frac{1}{2} \\beta \\right) \\neq"') as string
    expect(repairLatex(parsed)).toBe('\\text{cm} \\frac{1}{2} \\beta \\right) \\neq')
  })

  it('closes unbalanced braces but not escaped ones', () => {
    expect(repairLatex('6\\text{ cm')).toBe('6\\text{ cm}')
    expect(repairLatex('\\{a\\}')).toBe('\\{a\\}')
  })

  it('repairs diagram captions and labels but not plain captions', () => {
    expect(repairLatexFields({ type: 'Formula', latex: 'a^{2', caption: 'Note {' })).toEqual({
      type: 'Formula',
      latex: 'a^{2}',
      caption: 'Note {',
    })
    expect(repairLatexFields({ type: 'Diagram', caption: 'x^{2', shapes: [{ kind: 'label', latex: '\\frac{1' }] })).toEqual({
      type: 'Diagram',
      caption: 'x^{2}',
      shapes: [{ kind: 'label', latex: '\\frac{1}' }],
    })
  })

  it('recovers the side-length labels Gemma got wrong in testing', async () => {
    const answer = '{"elements":[{"id":"a","type":"MathLabel","position":{"x":100,"y":450},"latex":"6\\text{ cm"}]}'
    const events = await collect(chunked(answer))
    expect(events[0]).toMatchObject({ type: 'element', element: { latex: '6\\text{ cm}' } })
  })
})

describe('prose formulas', () => {
  const formula = (latex: string, caption?: string): ARElement => ({
    id: 'f',
    type: 'Formula',
    position: { x: 10, y: 20 },
    latex,
    ...(caption && { caption }),
    stepIndex: 2,
  })

  it('detects sentences but not math', () => {
    expect(looksLikeProse('In a right-angled triangle, the square of the hypotenuse')).toBe(true)
    expect(looksLikeProse('\\text{In a right-angled triangle, the square of the hypotenuse}')).toBe(true)
    expect(looksLikeProse('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')).toBe(false)
    expect(looksLikeProse('\\sin^2 x + \\cos^2 x = 1')).toBe(false)
    expect(looksLikeProse('A = \\pi r^2 \\text{ cm}^2')).toBe(false)
  })

  it('converts prose formulas into info cards', () => {
    const card = proseFormulaToCard(formula('In\\ a\\ right-angled\\ triangle,\\ the\\ square\\ of\\ the\\ hypotenuse', 'Theorem'))
    expect(card).toEqual({
      id: 'f',
      type: 'InfoCard',
      position: { x: 10, y: 20 },
      title: 'Theorem',
      body: 'In a right-angled triangle, the square of the hypotenuse',
      stepIndex: 2,
    })
  })

  it('extracts plain text from LaTeX prose', () => {
    expect(latexToPlainText('\\text{Area} \\; = \\mathrm{base} \\times height')).toBe('Area = base height')
    expect(latexToPlainText('First\\\\ then {next}')).toBe('First then next')
  })

  it('leaves real formulas alone', () => {
    const f = formula('c^2 = a^2 + b^2')
    expect(proseFormulaToCard(f)).toBe(f)
  })

  it('applies during streaming', async () => {
    const answer = JSON.stringify({
      elements: [{ id: 'p', type: 'Formula', position: { x: 500, y: 500 }, latex: '\\text{The sum of the squares of the legs}' }],
    })
    const events = await collect(chunked(answer))
    expect(events[0]).toMatchObject({ element: { type: 'InfoCard', title: 'Explanation', body: 'The sum of the squares of the legs' } })
  })
})
