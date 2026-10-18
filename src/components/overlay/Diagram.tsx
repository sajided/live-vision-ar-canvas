import type { BoardShape, Diagram as DiagramElement } from '../../ar/schema'
import { angleMark, arrowHead } from '../../ar/shapes'
import { ANGLE_SECONDS, boardShapeDuration, boardShapeOffsets } from '../../ar/trace'
import { motion } from 'motion/react'
import { FitTex } from '../math/FitTex'
import { Tex } from '../math/Tex'
import { CardShell } from './CardShell'
import { palette, RAINBOW } from './colors'
import { DrawnPath, SvgTag, TracedCircle, TracedPath, VertexMarkers } from './svgPrimitives'
import type { OverlayElementProps } from './types'

// Board units: the diagram is a 100×100 square.
const STROKE = 0.9
const TAG_SIZE = 5.5
const PEN_RADIUS = 1.6
// Board units are ~2.6 px on a phone, so markers shrink to stay pixel-sized.
const MARKER_SCALE = 0.38

function BoardShapeView({ shape, delay }: { shape: BoardShape; delay: number }) {
  const color = palette[shape.color].stroke
  switch (shape.kind) {
    case 'polygon':
      return (
        <>
          <TracedPath
            points={shape.points}
            closed={shape.closed}
            fill={shape.fill}
            color={color}
            // Closed figures get a color per edge; open curves (graphs) stay one color.
            edgeColors={shape.closed ? RAINBOW : undefined}
            width={STROKE}
            outline={0}
            delay={delay}
            duration={boardShapeDuration(shape)}
            penRadius={PEN_RADIUS}
          />
          <VertexMarkers
            points={shape.points}
            labels={shape.labels}
            closed={shape.closed}
            colors={RAINBOW}
            delay={delay}
            duration={boardShapeDuration(shape)}
            scale={MARKER_SCALE}
          />
        </>
      )
    case 'circle':
      return (
        <TracedCircle
          center={shape.center}
          radius={shape.radius}
          color={color}
          width={STROKE}
          outline={0}
          delay={delay}
          duration={boardShapeDuration(shape)}
          penRadius={PEN_RADIUS}
        />
      )
    case 'segment': {
      const arrow = shape.variant === 'arrow' ? arrowHead(shape.from, shape.to, 4) : null
      const end = arrow?.shaftEnd ?? shape.to
      return (
        <>
          <DrawnPath
            d={`M${shape.from.x} ${shape.from.y}L${end.x} ${end.y}`}
            color={color}
            width={STROKE}
            outline={0}
            delay={delay}
            duration={boardShapeDuration(shape)}
            ease="linear"
            dashed={shape.variant === 'dashed'}
          />
          {arrow && (
            <motion.polygon
              points={arrow.head}
              fill={color}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, delay: delay + boardShapeDuration(shape) * 0.85 }}
            />
          )}
        </>
      )
    }
    case 'angle': {
      const mark = angleMark(shape.vertex, shape.from, shape.to, 7, shape.right)
      return (
        <>
          <DrawnPath d={mark.path} color={color} width={STROKE * 0.8} outline={0} delay={delay} duration={ANGLE_SECONDS} />
          {shape.label && <SvgTag at={mark.labelAt} text={shape.label} size={TAG_SIZE} delay={delay + ANGLE_SECONDS} />}
        </>
      )
    }
    case 'point':
      return (
        <>
          <motion.circle
            cx={shape.position.x}
            cy={shape.position.y}
            r={1.4}
            fill={color}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay }}
          />
          {shape.label && (
            <SvgTag
              at={{ x: shape.position.x + 3.5, y: shape.position.y - 3.5 }}
              text={shape.label}
              size={TAG_SIZE}
              delay={delay}
            />
          )}
        </>
      )
    case 'label':
      return null // rendered as HTML so it can use KaTeX
  }
}

export function Diagram({ element, delay, onDismiss, placement, onMeasure, docked }: OverlayElementProps<DiagramElement>) {
  const offsets = boardShapeOffsets(element.shapes)
  const shapeDelay = (i: number) => delay + offsets[i]
  return (
    <CardShell
      id={element.id}
      delay={delay}
      placement={placement}
      onMeasure={onMeasure}
      docked={docked}
      onDismiss={onDismiss}
      dismissLabel="Dismiss diagram"
      stepIndex={element.stepIndex}
      title={element.title}
    >
      <div className="relative mx-auto mt-2 aspect-square" // Capped by screen height so a diagram fits the dock on short (landscape) screens.
        style={{ width: 'min(100%, 34dvh, calc(100dvh - 18rem))' }}>
        <div className="absolute inset-4">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {element.shapes.map((shape, i) => (
              <BoardShapeView key={i} shape={shape} delay={shapeDelay(i)} />
            ))}
          </svg>
          {element.shapes.map((shape, i) =>
            shape.kind === 'label' ? (
              <motion.div
                key={i}
                className={`absolute -translate-x-1/2 -translate-y-1/2 text-sm font-bold whitespace-nowrap ${palette[shape.color].text}`}
                style={{ left: `${shape.position.x}%`, top: `${shape.position.y}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: shapeDelay(i) }}
              >
                <Tex latex={shape.latex} />
              </motion.div>
            ) : null,
          )}
        </div>
      </div>
      {element.caption && (
        <FitTex latex={element.caption} size={19} className="mt-2" />
      )}
    </CardShell>
  )
}
