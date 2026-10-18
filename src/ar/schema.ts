import { z } from 'zod'

/**
 * The JSON contract between the model and the overlay renderer (PRD FR-3.1).
 *
 * Coordinates are percentages (0–100) of the square model image, not the
 * screen; the renderer projects them back onto the viewfinder. Elements are
 * revealed in array order.
 */

export const PctSchema = z.number().min(0).max(100)

export const PointSchema = z.strictObject({ x: PctSchema, y: PctSchema })

// A fixed palette keeps model output from reaching arbitrary CSS.
export const ColorSchema = z.enum(['blue', 'green', 'amber', 'red', 'violet', 'white']).default('blue')

const IdSchema = z.string().min(1).max(40)
/** What the tutor says aloud when this element appears (plain words, no LaTeX). */
const SaySchema = z.string().min(1).max(240).optional()

export const TargetBeaconSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('TargetBeacon'),
  position: PointSchema,
  label: z.string().min(1).max(40),
  color: ColorSchema,
})

export const ConnectorLineSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('ConnectorLine'),
  from: PointSchema,
  to: PointSchema,
  variant: z.enum(['solid', 'dashed', 'arrow']).default('arrow'),
  color: ColorSchema,
})

export const InfoCardSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('InfoCard'),
  position: PointSchema,
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(280),
  stepIndex: z.number().int().min(1).optional(),
})

// --- Math ---------------------------------------------------------------

/** LaTeX source; rendered with KaTeX (no HTML, no macros that expand unboundedly). */
const LatexSchema = (max: number) => z.string().min(1).max(max)
/** Short plain-text tag for angles and points, e.g. "θ", "90°", "A". */
const TagSchema = z.string().min(1).max(12)

export const FormulaSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('Formula'),
  position: PointSchema,
  latex: LatexSchema(300),
  caption: z.string().max(120).optional(),
  stepIndex: z.number().int().min(1).optional(),
})

/** Small formula drawn directly on the photo, e.g. a side length. */
export const MathLabelSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('MathLabel'),
  position: PointSchema,
  latex: LatexSchema(80),
  color: ColorSchema,
})

/** Vertex names, in the same order as `points` (e.g. ["A", "B", "C"]). */
const VertexLabelsSchema = z.array(TagSchema).max(12).optional()

export const PolygonSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('Polygon'),
  points: z.array(PointSchema).min(2).max(12),
  labels: VertexLabelsSchema,
  closed: z.boolean().default(true),
  fill: z.boolean().default(false),
  color: ColorSchema,
})

export const CircleSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('Circle'),
  center: PointSchema,
  /** Percentage of the image side. */
  radius: z.number().gt(0).max(100),
  color: ColorSchema,
})

export const AngleSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('Angle'),
  vertex: PointSchema,
  /** Points on each ray; the smaller angle between them is marked. */
  from: PointSchema,
  to: PointSchema,
  label: TagSchema.optional(),
  right: z.boolean().default(false),
  color: ColorSchema,
})

// Shapes inside a Diagram use the diagram's own 0–100 board space.
const BoardShapeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('polygon'),
    points: z.array(PointSchema).min(2).max(12),
    labels: VertexLabelsSchema,
    closed: z.boolean().default(true),
    fill: z.boolean().default(false),
    color: ColorSchema,
  }),
  z.strictObject({ kind: z.literal('circle'), center: PointSchema, radius: z.number().gt(0).max(100), color: ColorSchema }),
  z.strictObject({
    kind: z.literal('segment'),
    from: PointSchema,
    to: PointSchema,
    variant: z.enum(['solid', 'dashed', 'arrow']).default('solid'),
    color: ColorSchema,
  }),
  z.strictObject({
    kind: z.literal('angle'),
    vertex: PointSchema,
    from: PointSchema,
    to: PointSchema,
    label: TagSchema.optional(),
    right: z.boolean().default(false),
    color: ColorSchema,
  }),
  z.strictObject({ kind: z.literal('point'), position: PointSchema, label: TagSchema.optional(), color: ColorSchema }),
  z.strictObject({ kind: z.literal('label'), position: PointSchema, latex: LatexSchema(80), color: ColorSchema }),
])

/** A small whiteboard card: draws a figure that isn't in the photo. */
export const DiagramSchema = z.strictObject({
  id: IdSchema,
  say: SaySchema,
  type: z.literal('Diagram'),
  position: PointSchema,
  title: z.string().max(60).optional(),
  shapes: z.array(BoardShapeSchema).min(1).max(24),
  caption: LatexSchema(160).optional(),
  stepIndex: z.number().int().min(1).optional(),
})

export const ARElementSchema = z.discriminatedUnion('type', [
  TargetBeaconSchema,
  ConnectorLineSchema,
  InfoCardSchema,
  FormulaSchema,
  MathLabelSchema,
  PolygonSchema,
  CircleSchema,
  AngleSchema,
  DiagramSchema,
])

export const ARResponseSchema = z
  .strictObject({
    elements: z.array(ARElementSchema).min(1).max(24),
    summary: z.string().max(200).optional(),
  })
  .superRefine((response, ctx) => {
    const seen = new Set<string>()
    response.elements.forEach((element, index) => {
      if (seen.has(element.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate id "${element.id}"`, path: ['elements', index, 'id'] })
      }
      seen.add(element.id)
    })
  })

export type Point = z.infer<typeof PointSchema>
export type ARColor = z.infer<typeof ColorSchema>
export type TargetBeacon = z.infer<typeof TargetBeaconSchema>
export type ConnectorLine = z.infer<typeof ConnectorLineSchema>
export type InfoCard = z.infer<typeof InfoCardSchema>
export type Formula = z.infer<typeof FormulaSchema>
export type MathLabel = z.infer<typeof MathLabelSchema>
export type Polygon = z.infer<typeof PolygonSchema>
export type Circle = z.infer<typeof CircleSchema>
export type Angle = z.infer<typeof AngleSchema>
export type Diagram = z.infer<typeof DiagramSchema>
export type BoardShape = z.infer<typeof BoardShapeSchema>
export type ARElement = z.infer<typeof ARElementSchema>
export type ARElementType = ARElement['type']
export type ARResponse = z.infer<typeof ARResponseSchema>
/** Shape before defaults are applied, i.e. what a model may emit. */
export type ARResponseInput = z.input<typeof ARResponseSchema>
