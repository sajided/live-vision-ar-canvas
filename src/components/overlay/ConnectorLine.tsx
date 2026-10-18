import { motion } from 'motion/react'
import { useId } from 'react'
import type { ConnectorLine as ConnectorLineElement } from '../../ar/schema'
import { arrowHead } from '../../ar/shapes'
import { traceDuration } from '../../ar/trace'
import { palette } from './colors'
import { PenTip } from './svgPrimitives'
import type { OverlayElementProps } from './types'

const STROKE = 3
const HEAD = 12

export function ConnectorLine({ element, project, delay }: OverlayElementProps<ConnectorLineElement>) {
  const maskId = useId()
  const from = project(element.from)
  const to = project(element.to)
  const stroke = palette[element.color].stroke
  const duration = traceDuration(element)
  const dashed = element.variant === 'dashed'
  const arrow = element.variant === 'arrow' ? arrowHead(from, to, HEAD) : null
  const end = arrow?.shaftEnd ?? to

  return (
    <motion.g exit={{ opacity: 0, transition: { duration: 0.15 } }}>
      {/* An animated solid mask reveals the line, so dashed variants draw cleanly too. */}
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <motion.line
          x1={from.x}
          y1={from.y}
          x2={end.x}
          y2={end.y}
          stroke="white"
          strokeWidth={STROKE + 6}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration, ease: 'linear', delay }}
        />
      </mask>
      <g mask={`url(#${maskId})`} strokeLinecap="round">
        <line x1={from.x} y1={from.y} x2={end.x} y2={end.y} stroke="rgb(0 0 0 / 0.35)" strokeWidth={STROKE + 3} />
        <line
          x1={from.x}
          y1={from.y}
          x2={end.x}
          y2={end.y}
          stroke={stroke}
          strokeWidth={STROKE}
          strokeDasharray={dashed ? '8 8' : undefined}
        />
      </g>
      {arrow && (
        <motion.polygon
          points={arrow.head}
          fill={stroke}
          stroke="rgb(0 0 0 / 0.35)"
          strokeWidth={1}
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: delay + duration * 0.85 }}
        />
      )}
      <PenTip points={[from, end]} times={[0, 1]} delay={delay} duration={duration} color={stroke} radius={5} />
    </motion.g>
  )
}
