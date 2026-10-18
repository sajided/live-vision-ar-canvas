import type { Size } from '../../camera/geometry'
import type { Rect } from '../../ar/layout'
import type { Point } from '../../ar/schema'
import type { PxPoint } from '../../ar/project'

export interface OverlayElementProps<E> {
  element: E
  /** Model-image percentages → screen pixels. */
  project: (point: Point) => PxPoint
  screen: Size
  /** Entry delay in seconds, for staggered reveal. */
  delay: number
  onDismiss: (id: string) => void
  /** Collision-free box assigned by the renderer (cards only). */
  placement?: Rect
  /** Reports rendered height so the renderer can lay cards out (cards only). */
  onMeasure?: (id: string, height: number) => void
  /** Collision-free boxes for point labels, keyed by beaconLabelId / vertexLabelId. */
  labelRects?: ReadonlyMap<string, Rect>
  /** Rendered inside the step dock instead of floating at `placement` (cards only). */
  docked?: boolean
}
