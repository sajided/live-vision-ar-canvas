import type { Formula as FormulaElement } from '../../ar/schema'
import { FitTex } from '../math/FitTex'
import { CardShell } from './CardShell'
import type { OverlayElementProps } from './types'

export function Formula({ element, delay, onDismiss, placement, onMeasure }: OverlayElementProps<FormulaElement>) {
  return (
    <CardShell
      id={element.id}
      delay={delay}
      placement={placement}
      onMeasure={onMeasure}
      onDismiss={onDismiss}
      dismissLabel="Dismiss formula"
      stepIndex={element.stepIndex}
      title={element.caption}
    >
      <FitTex latex={element.latex} size={19} className="mt-1" />
    </CardShell>
  )
}
