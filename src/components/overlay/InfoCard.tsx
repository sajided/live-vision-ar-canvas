import type { InfoCard as InfoCardElement } from '../../ar/schema'
import { CardShell } from './CardShell'
import type { OverlayElementProps } from './types'

export function InfoCard({ element, delay, onDismiss, placement, onMeasure, docked }: OverlayElementProps<InfoCardElement>) {
  return (
    <CardShell
      id={element.id}
      delay={delay}
      placement={placement}
      onMeasure={onMeasure}
      docked={docked}
      onDismiss={onDismiss}
      dismissLabel={`Dismiss ${element.title}`}
      stepIndex={element.stepIndex}
      title={element.title}
    >
      <p className="mt-2 text-[17px] leading-relaxed font-medium">{element.body}</p>
    </CardShell>
  )
}
