import type { ComponentType } from 'react'
import { Angle } from '../components/overlay/Angle'
import { Circle } from '../components/overlay/Circle'
import { ConnectorLine } from '../components/overlay/ConnectorLine'
import { Diagram } from '../components/overlay/Diagram'
import { Formula } from '../components/overlay/Formula'
import { InfoCard } from '../components/overlay/InfoCard'
import { MathLabel } from '../components/overlay/MathLabel'
import { Polygon } from '../components/overlay/Polygon'
import { TargetBeacon } from '../components/overlay/TargetBeacon'
import type { OverlayElementProps } from '../components/overlay/types'
import type { ARElement, ARElementType } from './schema'

type Registry = {
  [K in ARElementType]: {
    component: ComponentType<OverlayElementProps<Extract<ARElement, { type: K }>>>
    /** SVG renders below interactive HTML (FR-4.1). */
    layer: 'svg' | 'html'
    /** Cards are placed by the collision-aware layout instead of sitting on their point. */
    card: boolean
  }
}

/** The only mapping from model output to UI: every element type is a precompiled component. */
export const registry = {
  TargetBeacon: { component: TargetBeacon, layer: 'html', card: false },
  ConnectorLine: { component: ConnectorLine, layer: 'svg', card: false },
  InfoCard: { component: InfoCard, layer: 'html', card: true },
  Formula: { component: Formula, layer: 'html', card: true },
  MathLabel: { component: MathLabel, layer: 'html', card: false },
  Polygon: { component: Polygon, layer: 'svg', card: false },
  Circle: { component: Circle, layer: 'svg', card: false },
  Angle: { component: Angle, layer: 'svg', card: false },
  Diagram: { component: Diagram, layer: 'html', card: true },
} satisfies Registry

export type CardElement = Extract<ARElement, { type: 'InfoCard' | 'Formula' | 'Diagram' }>

export function isCard(element: ARElement): element is CardElement {
  return registry[element.type].card
}

/** Numbered steps and diagrams are read in sequence, so they live in the step dock. */
export function isStep(element: ARElement): boolean {
  return isCard(element) && (element.type === 'Diagram' || element.stepIndex !== undefined)
}
