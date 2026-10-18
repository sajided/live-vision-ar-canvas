import { motion } from 'motion/react'
import { beaconLabelId } from '../../ar/labels'
import type { TargetBeacon as TargetBeaconElement } from '../../ar/schema'
import { HALO, palette } from './colors'
import type { OverlayElementProps } from './types'

const HIT_SIZE = 44

export function TargetBeacon({ element, project, delay, onDismiss, labelRects }: OverlayElementProps<TargetBeaconElement>) {
  const { x, y } = project(element.position)
  const labelRect = labelRects?.get(beaconLabelId(element.id))
  const colors = palette[element.color]

  return (
    <motion.button
      type="button"
      aria-label={`Dismiss ${element.label}`}
      onClick={() => onDismiss(element.id)}
      className="pointer-events-auto absolute flex size-11 items-center justify-center"
      style={{ left: x - HIT_SIZE / 2, top: y - HIT_SIZE / 2 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay }}
    >
      <motion.span
        className={`absolute size-4 rounded-full ${colors.dot}`}
        animate={{ scale: [1, 2.6], opacity: [0.7, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: delay + 0.3 }}
      />
      <span className={`relative size-4 rounded-full ring-2 ring-white shadow-lg ${colors.dot}`} />
      <span
        data-overlay="label"
        className={`absolute text-sm leading-5 font-bold whitespace-nowrap ${HALO} ${colors.text} ${labelRect ? 'text-center' : 'bottom-full mb-0.5'}`}
        // Placed by the label layout, relative to this 44px button.
        style={labelRect && { left: labelRect.left - (x - HIT_SIZE / 2), top: labelRect.top - (y - HIT_SIZE / 2), width: labelRect.width }}
      >
        {element.label}
      </span>
    </motion.button>
  )
}
