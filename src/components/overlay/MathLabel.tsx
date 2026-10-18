import { motion } from 'motion/react'
import { beaconLabelId } from '../../ar/labels'
import type { MathLabel as MathLabelElement } from '../../ar/schema'
import { Tex } from '../math/Tex'
import { HALO, palette } from './colors'
import type { OverlayElementProps } from './types'

export function MathLabel({ element, project, delay, labelRects }: OverlayElementProps<MathLabelElement>) {
  const rect = labelRects?.get(beaconLabelId(element.id))
  // Centered on its collision-free box, or on the model's point as a fallback.
  const { x, y } = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : project(element.position)
  return (
    <motion.div
      data-overlay="label"
      className={`absolute -translate-x-1/2 -translate-y-1/2 text-[17px] font-bold whitespace-nowrap ${HALO} ${palette[element.color].text}`}
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 22, delay }}
    >
      <Tex latex={element.latex} />
    </motion.div>
  )
}
