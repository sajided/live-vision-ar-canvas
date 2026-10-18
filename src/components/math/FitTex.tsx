import { useLayoutEffect, useRef } from 'react'
import { useKatexReady } from './katexLoader'
import { Tex } from './Tex'

const MIN_SCALE = 0.55

interface FitTexProps {
  latex: string
  /** Base font size in px; shrinks down to MIN_SCALE of this to fit. */
  size: number
  className?: string
}

/**
 * Display-style math that never scrolls: rendered inline (so KaTeX can wrap
 * at = + − etc.) with \displaystyle sizing, then scaled down if an
 * unbreakable part is still wider than the card.
 */
export function FitTex({ latex, size, className }: FitTexProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const ready = useKatexReady()

  // Runs before the parent card measures itself, so its height is final.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    box.style.fontSize = `${size}px`
    const needed = box.scrollWidth
    const available = box.clientWidth
    if (needed > available && available > 0) {
      box.style.fontSize = `${size * Math.max(MIN_SCALE, available / needed)}px`
    }
  }, [latex, size, ready])

  return (
    <div ref={boxRef} className={`overflow-hidden py-1 leading-normal break-words ${className ?? ''}`}>
      <Tex latex={`\\displaystyle ${latex}`} />
    </div>
  )
}
