import type { ReactNode } from 'react'
import type { Size } from '../camera/geometry'

interface OverlayRootProps {
  /** Screen size in CSS pixels; the SVG uses a matching pixel viewBox. */
  size: Size
  /** SVG content (connectors). */
  lines?: ReactNode
  /** Positioned HTML elements (beacons, cards). */
  children?: ReactNode
}

/** Overlay layers aligned with the viewfinder. Lines sit below interactive HTML (FR-4.1). */
export function OverlayRoot({ size, lines, children }: OverlayRootProps) {
  return (
    <>
      <svg
        className="pointer-events-none fixed inset-0 z-10 h-dvh w-screen"
        viewBox={`0 0 ${size.width} ${size.height}`}
        aria-hidden
      >
        {lines}
      </svg>
      <div className="pointer-events-none fixed inset-0 z-20 h-dvh w-screen">{children}</div>
    </>
  )
}
