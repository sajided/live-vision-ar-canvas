import { loadKatex, useKatexReady } from './katexLoader'
import { renderTex } from './renderTex'

export function Tex({ latex, display = false, className }: { latex: string; display?: boolean; className?: string }) {
  const ready = useKatexReady()
  const html = ready ? renderTex(latex, display) : null
  if (html === null) {
    // Plain source for the moment before KaTeX arrives.
    void loadKatex()
    return <span className={`font-mono text-[0.85em] ${className ?? ''}`}>{latex}</span>
  }
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
