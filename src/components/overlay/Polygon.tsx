import { motion } from 'motion/react'
import { vertexLabelId } from '../../ar/labels'
import type { Polygon as PolygonElement } from '../../ar/schema'
import { traceDuration } from '../../ar/trace'
import { palette, RAINBOW } from './colors'
import { TracedPath, VertexMarkers } from './svgPrimitives'
import type { OverlayElementProps } from './types'

export function Polygon({ element, project, delay, labelRects }: OverlayElementProps<PolygonElement>) {
  const points = element.points.map(project)
  const duration = traceDuration(element)
  const { stroke } = palette[element.color]
  return (
    <motion.g exit={{ opacity: 0, transition: { duration: 0.15 } }}>
      <TracedPath
        points={points}
        closed={element.closed}
        fill={element.fill}
        color={stroke}
        // Closed figures get a color per edge; open curves stay one color.
        edgeColors={element.closed ? RAINBOW : undefined}
        width={3.5}
        delay={delay}
        duration={duration}
        penRadius={6}
      />
      <VertexMarkers
        points={points}
        labels={element.labels}
        closed={element.closed}
        // Corners take the color of the edge leaving them.
        colors={RAINBOW}
        labelRect={(i) => labelRects?.get(vertexLabelId(element.id, i))}
        delay={delay}
        duration={duration}
      />
    </motion.g>
  )
}
