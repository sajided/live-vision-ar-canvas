import { motion } from 'motion/react'
import type { Angle as AngleElement } from '../../ar/schema'
import { angleMark } from '../../ar/shapes'
import { ANGLE_SECONDS } from '../../ar/trace'
import { palette } from './colors'
import { DrawnPath, SvgTag } from './svgPrimitives'
import type { OverlayElementProps } from './types'

const RADIUS = 22

export function Angle({ element, project, delay }: OverlayElementProps<AngleElement>) {
  const mark = angleMark(project(element.vertex), project(element.from), project(element.to), RADIUS, element.right)
  return (
    <motion.g exit={{ opacity: 0, transition: { duration: 0.15 } }}>
      <DrawnPath d={mark.path} color={palette[element.color].stroke} width={2.5} delay={delay} duration={ANGLE_SECONDS} />
      {element.label && <SvgTag at={mark.labelAt} text={element.label} size={15} delay={delay + ANGLE_SECONDS} />}
    </motion.g>
  )
}
