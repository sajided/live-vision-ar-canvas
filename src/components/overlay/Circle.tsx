import { motion } from 'motion/react'
import type { Circle as CircleElement } from '../../ar/schema'
import { traceDuration } from '../../ar/trace'
import { palette } from './colors'
import { TracedCircle } from './svgPrimitives'
import type { OverlayElementProps } from './types'

export function Circle({ element, project, delay }: OverlayElementProps<CircleElement>) {
  const center = project(element.center)
  // Projection is a uniform scale, so the radius can be measured along x.
  const edge = project({ x: element.center.x + element.radius, y: element.center.y })
  return (
    <motion.g exit={{ opacity: 0, transition: { duration: 0.15 } }}>
      <TracedCircle
        center={center}
        radius={Math.hypot(edge.x - center.x, edge.y - center.y)}
        color={palette[element.color].stroke}
        width={3}
        delay={delay}
        duration={traceDuration(element)}
        penRadius={6}
      />
    </motion.g>
  )
}
