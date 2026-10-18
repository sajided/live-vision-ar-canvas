const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

/** The user asked the OS for less motion: skip pen pacing so answers appear at once. */
export function prefersReducedMotion(): boolean {
  return query?.matches ?? false
}
