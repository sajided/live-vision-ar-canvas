import { describe, expect, it } from 'vitest'
import type { ARElement } from '../ar/schema'
import { presentFrom, spokenText, type LessonDeps } from './lesson'

const beacon = (id: string, say?: string): ARElement => ({
  id,
  type: 'TargetBeacon',
  position: { x: 1, y: 1 },
  label: id,
  color: 'blue',
  ...(say && { say }),
})

function harness() {
  const log: string[] = []
  const controller = new AbortController()
  const deps: LessonDeps = {
    release: (e) => log.push(`show ${e.id}`),
    speak: async (text) => {
      log.push(`say "${text}"`)
    },
    drawMs: () => 0,
    sleep: async () => {},
    onSpeaking: () => {},
    signal: controller.signal,
  }
  return { log, deps, controller }
}

describe('spokenText', () => {
  it('prefers say, then falls back to card text', () => {
    expect(spokenText(beacon('a', 'Look here.'))).toBe('Look here.')
    expect(spokenText(beacon('a'))).toBeNull()
    expect(spokenText({ id: 'c', type: 'InfoCard', position: { x: 1, y: 1 }, title: 'Why', body: 'Because.' })).toBe('Why. Because.')
  })
})

describe('presentFrom', () => {
  it('shows each element then speaks it, in order, and resumes from where it stopped', async () => {
    const { log, deps } = harness()
    const elements = [beacon('a', 'First.'), beacon('b'), beacon('c', 'Third.')]
    const next = await presentFrom(elements.slice(0, 2), 0, deps)
    expect(next).toBe(2)
    await presentFrom(elements, next, deps)
    expect(log).toEqual(['show a', 'say "First."', 'show b', 'show c', 'say "Third."'])
  })

  it('waits for both the drawing and the speech before moving on', async () => {
    const { log, deps } = harness()
    let finishSpeech!: () => void
    deps.speak = () => new Promise<void>((resolve) => (finishSpeech = resolve))
    const running = presentFrom([beacon('a', 'Hi.'), beacon('b')], 0, deps)
    await Promise.resolve()
    expect(log).toEqual(['show a'])
    finishSpeech()
    await running
    expect(log).toEqual(['show a', 'show b'])
  })

  it('stops when aborted', async () => {
    const { log, deps, controller } = harness()
    deps.speak = async () => controller.abort()
    const next = await presentFrom([beacon('a', 'Hi.'), beacon('b')], 0, deps)
    expect(next).toBe(1)
    expect(log).toEqual(['show a'])
  })
})

describe('readingMs', () => {
  it('gives short lines a floor and long lines time to read', async () => {
    const { readingMs } = await import('./narrator')
    expect(readingMs('Hi.')).toBe(1200)
    expect(readingMs('x'.repeat(100))).toBe(5000)
  })
})
