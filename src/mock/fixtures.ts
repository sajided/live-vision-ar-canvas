import type { ARResponseInput } from '../ar/schema'

/**
 * Canned responses for the PRD use cases. Coordinates here are authored as
 * viewport percentages; the mock provider converts them to model-image space.
 */
export const fixtures = {
  pinpoint: {
    summary: 'The USB-C port is on the lower edge.',
    elements: [
      { id: 'port', type: 'TargetBeacon', position: { x: 50, y: 58 }, label: 'USB-C port', color: 'green' },
      {
        id: 'port-info',
        type: 'InfoCard',
        position: { x: 50, y: 30 },
        title: 'USB-C power input',
        body: 'Connect a 5 V / 3 A supply here. The LED next to it turns green once power is stable.',
      },
    ],
  },
  trace: {
    summary: 'Signal path from the sensor to the microcontroller.',
    elements: [
      { id: 'src', type: 'TargetBeacon', position: { x: 22, y: 30 }, label: 'Sensor OUT', color: 'amber' },
      { id: 'seg-1', type: 'ConnectorLine', from: { x: 22, y: 30 }, to: { x: 48, y: 38 }, variant: 'solid', color: 'amber' },
      { id: 'seg-2', type: 'ConnectorLine', from: { x: 48, y: 38 }, to: { x: 62, y: 56 }, variant: 'dashed', color: 'amber' },
      { id: 'seg-3', type: 'ConnectorLine', from: { x: 62, y: 56 }, to: { x: 78, y: 64 }, color: 'amber' },
      { id: 'dst', type: 'TargetBeacon', position: { x: 78, y: 64 }, label: 'GPIO 4', color: 'blue' },
    ],
  },
  steps: {
    summary: 'Three steps to reset the valve.',
    elements: [
      { id: 'b1', type: 'TargetBeacon', position: { x: 30, y: 36 }, label: 'Shut-off', color: 'red' },
      { id: 'c1', type: 'InfoCard', position: { x: 30, y: 36 }, title: 'Close the shut-off', body: 'Turn clockwise until it stops.', stepIndex: 1 },
      { id: 'a1', type: 'ConnectorLine', from: { x: 34, y: 40 }, to: { x: 60, y: 52 }, variant: 'arrow', color: 'white' },
      { id: 'b2', type: 'TargetBeacon', position: { x: 64, y: 54 }, label: 'Bleed screw', color: 'violet' },
      { id: 'c2', type: 'InfoCard', position: { x: 64, y: 54 }, title: 'Open the bleed screw', body: 'Half a turn releases trapped pressure.', stepIndex: 2 },
      { id: 'b3', type: 'TargetBeacon', position: { x: 46, y: 72 }, label: 'Reset lever', color: 'green' },
      { id: 'c3', type: 'InfoCard', position: { x: 46, y: 72 }, title: 'Pull the reset lever', body: 'Hold for 3 seconds, then reopen the shut-off.', stepIndex: 3 },
    ],
  },
  geometry: {
    summary: 'With legs 3 and 4, the hypotenuse is 5.',
    elements: [
      {
        id: 'tri',
        type: 'Polygon',
        points: [{ x: 25, y: 68 }, { x: 75, y: 68 }, { x: 25, y: 38 }],
        labels: ['A', 'B', 'C'],
        color: 'amber',
        fill: true,
      },
      { id: 'mid', type: 'ConnectorLine', from: { x: 25, y: 68 }, to: { x: 50, y: 53 }, variant: 'dashed', color: 'white' },
      { id: 'right', type: 'Angle', vertex: { x: 25, y: 68 }, from: { x: 75, y: 68 }, to: { x: 25, y: 38 }, right: true, color: 'white' },
      { id: 'theta', type: 'Angle', vertex: { x: 75, y: 68 }, from: { x: 25, y: 68 }, to: { x: 25, y: 38 }, label: 'θ', color: 'green' },
      { id: 'a', type: 'MathLabel', position: { x: 17, y: 53 }, latex: 'a = 3', color: 'amber' },
      { id: 'b', type: 'MathLabel', position: { x: 50, y: 73 }, latex: 'b = 4', color: 'amber' },
      { id: 'c', type: 'MathLabel', position: { x: 55, y: 49 }, latex: 'c = ?', color: 'violet' },
      { id: 's1', type: 'Formula', position: { x: 55, y: 49 }, latex: 'c^2 = a^2 + b^2', caption: 'Pythagorean theorem', stepIndex: 1 },
      { id: 's2', type: 'Formula', position: { x: 55, y: 49 }, latex: 'c^2 = 3^2 + 4^2 = 25', caption: 'Substitute the legs', stepIndex: 2 },
      { id: 's3', type: 'Formula', position: { x: 55, y: 49 }, latex: 'c = \\sqrt{25} = 5', caption: 'Take the square root', stepIndex: 3 },
    ],
  },
  algebra: {
    summary: 'The quadratic factors, so the roots are x = 2 and x = 3.',
    elements: [
      { id: 'f1', type: 'Formula', position: { x: 50, y: 40 }, latex: 'x^2 - 5x + 6 = 0', caption: 'Start with the equation', stepIndex: 1 },
      { id: 'f2', type: 'Formula', position: { x: 50, y: 40 }, latex: '(x - 2)(x - 3) = 0', caption: 'Factor: −2 · −3 = 6 and −2 + −3 = −5', stepIndex: 2 },
      { id: 'f3', type: 'Formula', position: { x: 50, y: 40 }, latex: 'x = 2 \\quad\\text{or}\\quad x = 3', caption: 'Each factor can be zero', stepIndex: 3 },
      {
        id: 'graph',
        type: 'Diagram',
        position: { x: 50, y: 40 },
        title: 'The roots are where the curve meets the x-axis',
        stepIndex: 4,
        shapes: [
          { kind: 'segment', from: { x: 0, y: 80 }, to: { x: 100, y: 80 }, variant: 'arrow', color: 'white' },
          {
            kind: 'polygon',
            closed: false,
            color: 'blue',
            points: [
              { x: 0, y: 20 }, { x: 10, y: 42.5 }, { x: 20, y: 60 }, { x: 30, y: 72.5 }, { x: 40, y: 80 }, { x: 50, y: 82.5 },
              { x: 60, y: 80 }, { x: 70, y: 72.5 }, { x: 80, y: 60 }, { x: 90, y: 42.5 }, { x: 100, y: 20 },
            ],
          },
          { kind: 'point', position: { x: 40, y: 80 }, label: '2', color: 'green' },
          { kind: 'point', position: { x: 60, y: 80 }, label: '3', color: 'green' },
          { kind: 'label', position: { x: 82, y: 30 }, latex: 'y = x^2 - 5x + 6', color: 'blue' },
        ],
      },
    ],
  },
} satisfies Record<string, ARResponseInput>

/** Deliberately broken output to exercise the validation failure path. */
export const invalidFixture: unknown = {
  elements: [
    { id: 'x', type: 'Spotlight', position: { x: 50, y: 50 } },
    { id: 'y', type: 'TargetBeacon', position: { x: 140, y: -5 }, label: 'Off grid' },
  ],
}

export type FixtureName = keyof typeof fixtures
