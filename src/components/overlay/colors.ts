import type { ARColor } from '../../ar/schema'

// Full class strings so Tailwind can see them at build time.
export const palette: Record<ARColor, { dot: string; stroke: string; text: string }> = {
  blue: { dot: 'bg-cyan-400', stroke: '#22d3ee', text: 'text-cyan-300' },
  green: { dot: 'bg-lime-400', stroke: '#a3e635', text: 'text-lime-300' },
  amber: { dot: 'bg-yellow-400', stroke: '#facc15', text: 'text-yellow-300' },
  red: { dot: 'bg-pink-500', stroke: '#f472b6', text: 'text-pink-300' },
  violet: { dot: 'bg-purple-400', stroke: '#c084fc', text: 'text-purple-300' },
  white: { dot: 'bg-white', stroke: '#ffffff', text: 'text-white' },
}

/** Vivid cycle for the edges and corners of traced figures, and step badges. */
export const RAINBOW = ['#22d3ee', '#a3e635', '#facc15', '#fb923c', '#f472b6', '#c084fc'] as const
export const RAINBOW_BG = ['bg-cyan-400', 'bg-lime-400', 'bg-yellow-400', 'bg-orange-400', 'bg-pink-400', 'bg-purple-400'] as const

export const rainbow = (i: number) => RAINBOW[((i % RAINBOW.length) + RAINBOW.length) % RAINBOW.length]

/** Dark halo that keeps text readable without a background, on paper or dark scenes alike. */
export const HALO = '[text-shadow:0_0_2px_rgb(0_0_0),0_1px_3px_rgb(0_0_0/0.9),0_0_10px_rgb(0_0_0/0.7)]'
