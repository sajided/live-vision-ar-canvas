/**
 * Haptic + audio cues. Sounds are synthesized with WebAudio (no asset files);
 * haptics use navigator.vibrate, which Android supports and iOS Safari does not.
 */

const MUTE_KEY = 'stepproof:muted'

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Storage blocked (private mode): the choice lasts for this session only.
  }
}

/** iOS only allows audio after a user gesture: create/resume the context on the first tap. */
export function unlockAudioOnFirstGesture(): void {
  const unlock = () => {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!ctx && AudioCtor) ctx = new AudioCtor()
    void ctx?.resume()
  }
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}

interface Tone {
  from: number
  to?: number
  duration: number
  gain: number
  type?: OscillatorType
  delay?: number
}

function play(...tones: Tone[]) {
  if (muted || !ctx || ctx.state !== 'running') return
  for (const { from, to = from, duration, gain, type = 'sine', delay = 0 } of tones) {
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(to, start + duration)
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(amp).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  }
}

export const feedback = {
  shutter() {
    vibrate(10)
    play({ from: 2400, to: 900, duration: 0.05, gain: 0.12, type: 'triangle' })
  },
  micStart() {
    vibrate(15)
    play({ from: 520, to: 880, duration: 0.09, gain: 0.08 })
  },
  micStop() {
    vibrate(15)
    play({ from: 880, to: 520, duration: 0.09, gain: 0.08 })
  },
  firstElement() {
    vibrate(8)
    play({ from: 660, to: 990, duration: 0.12, gain: 0.07 })
  },
  step() {
    play({ from: 1320, duration: 0.04, gain: 0.035 })
  },
  error() {
    vibrate([30, 60, 30])
    play({ from: 330, to: 220, duration: 0.16, gain: 0.08, type: 'triangle' })
  },
}
