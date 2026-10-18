import { describe, expect, it } from 'vitest'
import { ElementStreamParser } from './elementStream.js'

const answer = JSON.stringify({
  elements: [
    { id: 'a', type: 'TargetBeacon', position: { x: 1, y: 2 }, label: 'Brace } and "quote" [x]' },
    { id: 'b', type: 'InfoCard', position: { x: 3, y: 4 }, title: 'T', body: 'Back\\slash {nested}' },
  ],
  summary: 'Done {really}',
})

function feed(text: string, size: number) {
  const parser = new ElementStreamParser()
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(...parser.push(text.slice(i, i + size)))
  return { elements: out.map((s) => JSON.parse(s)), summary: parser.summary }
}

describe('ElementStreamParser', () => {
  it('extracts elements from a whole answer', () => {
    const { elements, summary } = feed(answer, answer.length)
    expect(elements.map((e) => e.id)).toEqual(['a', 'b'])
    expect(elements[0].label).toBe('Brace } and "quote" [x]')
    expect(elements[1].body).toBe('Back\\slash {nested}')
    expect(summary).toBe('Done {really}')
  })

  it.each([1, 2, 3, 7, 13])('handles chunk boundaries anywhere (size %i)', (size) => {
    expect(feed(answer, size).elements).toEqual(JSON.parse(answer).elements)
  })

  it('ignores code fences and surrounding prose', () => {
    const { elements } = feed(`Sure! Here you go:\n\`\`\`json\n${answer}\n\`\`\`\nHope that helps.`, 5)
    expect(elements).toHaveLength(2)
  })

  it('reads summary written before elements', () => {
    const text = JSON.stringify({ summary: 'First', elements: [{ id: 'z' }] })
    expect(feed(text, 4)).toEqual({ elements: [{ id: 'z' }], summary: 'First' })
  })

  it('emits each element as soon as it closes', () => {
    const parser = new ElementStreamParser()
    expect(parser.push('{"elements":[{"id":"a"}')).toEqual(['{"id":"a"}'])
    expect(parser.push(',{"id":"b"')).toEqual([])
    expect(parser.push('}]}')).toEqual(['{"id":"b"}'])
  })

  it('ignores objects outside the elements array', () => {
    const text = JSON.stringify({ meta: { id: 'm' }, elements: [{ id: 'e' }], extra: [{ id: 'x' }] })
    expect(feed(text, 6).elements).toEqual([{ id: 'e' }])
  })
})

describe('ElementStreamParser.complete', () => {
  it('is true only once the root object closes', () => {
    const parser = new ElementStreamParser()
    parser.push('{"elements":[{"id":"a"}')
    expect(parser.complete).toBe(false)
    parser.push(']}')
    expect(parser.complete).toBe(true)
  })

  it('stays false for a cut-off answer', () => {
    const parser = new ElementStreamParser()
    parser.push('{"elements":[{"id":"a"},{"id":"b","title":"half')
    expect(parser.complete).toBe(false)
  })
})

describe('LaTeX brace outside the string', () => {
  // Real Gemma output: the closing brace of \text{ m} lands after the quote.
  const raw =
    '{"elements":[{"id":"len","type":"MathLabel","position":{"x":496,"y":315},"latex":"l = 7\\\\text{ m"},"color":"amber"},' +
    '{"id":"f4","type":"Formula","position":{"x":500,"y":350},"latex":"P = 20\\\\text{ m"},"caption":"Final answer"}],' +
    '"summary":"The perimeter of the rectangle is 20 m."}'

  it.each([1, 3, raw.length])('moves the brace back inside and keeps the structure (chunk %i)', (size) => {
    const parser = new ElementStreamParser()
    const out: string[] = []
    for (let i = 0; i < raw.length; i += size) out.push(...parser.push(raw.slice(i, i + size)))
    const elements = out.map((s) => JSON.parse(s))
    expect(elements).toEqual([
      { id: 'len', type: 'MathLabel', position: { x: 496, y: 315 }, latex: 'l = 7\\text{ m}', color: 'amber' },
      { id: 'f4', type: 'Formula', position: { x: 500, y: 350 }, latex: 'P = 20\\text{ m}', caption: 'Final answer' },
    ])
    expect(parser.summary).toBe('The perimeter of the rectangle is 20 m.')
    expect(parser.complete).toBe(true)
  })

  it('leaves balanced LaTeX and plain text alone', () => {
    const parser = new ElementStreamParser()
    const text = '{"elements":[{"latex":"\\\\frac{1}{2}","body":"set {a"}]}'
    expect(parser.push(text).map((s) => JSON.parse(s))).toEqual([{ latex: '\\frac{1}{2}', body: 'set {a' }])
  })
})
