import { SendHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, type FormEvent } from 'react'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

interface QueryBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (query: string) => void
  autoFocus: boolean
  busy: boolean
}

/** Floating question input for the snapshot-and-type flow (FR-2.2). */
export function QueryBar({ value, onChange, onSubmit, autoFocus, busy }: QueryBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboard = useKeyboardInset()

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Drop the keyboard so the answer isn't hidden behind it.
    inputRef.current?.blur()
    onSubmit(value)
  }

  return (
    <motion.form
      data-testid="query-bar"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed inset-x-4 z-30 mx-auto flex max-w-md items-center gap-2 rounded-full border border-white/15 bg-black/60 py-1.5 pr-1.5 pl-4 shadow-2xl backdrop-blur-md"
      // Sit above the on-screen keyboard when it is open (iOS doesn't resize the layout viewport).
      style={{ bottom: keyboard ? keyboard + 12 : 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 6.5rem)' }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about this problem…"
        maxLength={500}
        enterKeyHint="send"
        className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/50 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        aria-label="Ask"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black active:scale-95 disabled:opacity-50"
      >
        <SendHorizontal className="size-5" />
      </button>
    </motion.form>
  )
}
