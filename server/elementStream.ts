/**
 * Incrementally extracts complete element objects from a streamed JSON
 * answer shaped like `{ "elements": [ {...}, {...} ], "summary": "..." }`.
 *
 * Tolerates text or code fences around the JSON, and chunk boundaries
 * anywhere (including inside strings and escapes).
 */
export class ElementStreamParser {
  private depth = 0
  private inString = false
  private escaped = false
  /** Most recent string literal at depth 1, to recognise keys. */
  private stringBuf = ''
  private lastKey: string | null = null
  private inElements = false
  private elementBuf: string | null = null
  private summaryValue: string | undefined
  private rootOpened = false
  private rootClosed = false
  // Gemma often closes a LaTeX string before its brace: "7\\text{ m"}," instead of "7\\text{ m}",
  private stringBraces = 0
  private stringHasBackslash = false
  /** Unclosed `{` in the LaTeX-like string that just ended inside an element. */
  private braceDebt = 0
  /** A `}` (plus lookahead) held until we know whether it ends the object or belongs to the string. */
  private held: string | null = null
  private out: string[] = []

  /** Feed a chunk; returns any element JSON strings completed by it. */
  push(chunk: string): string[] {
    this.out = []
    for (const ch of chunk) this.feed(ch)
    return this.out
  }

  /** Release anything held for lookahead; call when the stream ends. */
  flush(): string[] {
    this.out = []
    if (this.held !== null) this.release(false)
    return this.out
  }

  /** Whether the root JSON object was opened and closed (a cut-off answer leaves it open). */
  get complete(): boolean {
    return this.rootClosed
  }

  get summary(): string | undefined {
    return this.summaryValue
  }

  private feed(ch: string) {
    if (this.held !== null) {
      this.held += ch
      // `"},"` + `"` means another field follows: the brace was LaTeX. Anything else is structure.
      if (this.held.length === 2 && ch === ',') return
      this.release(this.held.length === 3 && this.held.endsWith(',"'))
      return
    }
    if (this.braceDebt > 0) {
      if (ch === '}' && this.elementBuf?.endsWith('"')) {
        this.held = '}'
        return
      }
      this.braceDebt = 0
    }
    this.step(ch)
  }

  private release(braceBelongsToString: boolean) {
    const held = this.held ?? ''
    this.held = null
    if (braceBelongsToString && this.elementBuf !== null) {
      // Move the brace back inside the string: ..."} → ...}"
      this.elementBuf = `${this.elementBuf.slice(0, -1)}}"`
      this.braceDebt--
      for (const c of held.slice(1)) this.feed(c)
    } else {
      this.braceDebt = 0
      for (const c of held) this.step(c)
    }
  }

  private step(ch: string) {
    if (this.elementBuf !== null) this.elementBuf += ch

    if (this.inString) {
      if (this.depth === 1) this.stringBuf += ch
      if (this.escaped) this.escaped = false
      else if (ch === '\\') {
        this.escaped = true
        this.stringHasBackslash = true
      } else if (ch === '{') this.stringBraces++
      else if (ch === '}') this.stringBraces--
      else if (ch === '"') {
        this.inString = false
        if (this.depth === 1) this.finishTopLevelString()
        if (this.depth >= 3 && this.stringHasBackslash && this.stringBraces > 0) this.braceDebt = this.stringBraces
      }
      return
    }

    switch (ch) {
      case '"':
        this.inString = true
        this.stringBraces = 0
        this.stringHasBackslash = false
        if (this.depth === 1) this.stringBuf = '"'
        break
      case '{':
        if (this.depth === 0) this.rootOpened = true
        this.depth++
        if (this.depth === 3 && this.inElements) this.elementBuf = '{'
        break
      case '}':
        if (this.depth === 3 && this.elementBuf !== null) {
          this.out.push(this.elementBuf)
          this.elementBuf = null
        }
        this.depth = Math.max(0, this.depth - 1)
        if (this.depth === 0 && this.rootOpened) this.rootClosed = true
        break
      case '[':
        this.depth++
        if (this.depth === 2 && this.lastKey === 'elements') this.inElements = true
        break
      case ']':
        if (this.depth === 2) this.inElements = false
        this.depth = Math.max(0, this.depth - 1)
        break
      case ',':
        if (this.depth === 1) this.lastKey = null
        break
    }
  }

  private finishTopLevelString() {
    let value: string
    try {
      value = JSON.parse(this.stringBuf) as string
    } catch {
      return
    }
    if (this.lastKey === null) {
      this.lastKey = value
    } else if (this.lastKey === 'summary') {
      this.summaryValue = value
    }
  }
}
