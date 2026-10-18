import { useEffect, useRef } from 'react'

/** Shows the exact frame that was captured, on top of the live feed. */
export function FrozenFrame({ still }: { still: HTMLCanvasElement }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.replaceChildren(still)
    return () => container.replaceChildren()
  }, [still])

  return <div ref={containerRef} className="fixed inset-0 h-dvh w-screen bg-black" />
}
