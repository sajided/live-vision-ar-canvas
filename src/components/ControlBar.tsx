import { Eraser, Keyboard, Mic, X } from 'lucide-react'
import type { PointerEvent } from 'react'

interface ControlBarProps {
  frozen: boolean
  canCapture: boolean
  canClear: boolean
  speechSupported: boolean
  listening: boolean
  onCapture: () => void
  onResume: () => void
  onClear: () => void
  onTalkStart: () => void
  onTalkEnd: () => void
  onTalkCancel: () => void
  /** Show the button that reopens the question bar. */
  canType: boolean
  onType: () => void
}

export function ControlBar({
  frozen,
  canCapture,
  canClear,
  speechSupported,
  listening,
  onCapture,
  onResume,
  onClear,
  onTalkStart,
  onTalkEnd,
  onTalkCancel,
  canType,
  onType,
}: ControlBarProps) {
  const canTalk = speechSupported && (frozen || canCapture)

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onTalkStart()
  }

  return (
    <div
      data-testid="control-bar"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around bg-gradient-to-t from-black/60 to-transparent pt-10"
      style={{
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {speechSupported ? (
        // Hold-to-talk (FR-2.1): the frame is snapped on release.
        <button
          type="button"
          disabled={!canTalk}
          aria-label="Hold to ask"
          aria-pressed={listening}
          onPointerDown={handlePointerDown}
          onPointerUp={onTalkEnd}
          onPointerCancel={onTalkCancel}
          onContextMenu={(e) => e.preventDefault()}
          className={`flex size-12 touch-none items-center justify-center rounded-full backdrop-blur transition [-webkit-touch-callout:none] disabled:opacity-40 ${
            listening ? 'scale-125 bg-red-500 ring-4 ring-red-500/40' : 'bg-white/15'
          }`}
        >
          <Mic className="size-5" />
        </button>
      ) : (
        <span className="size-12" aria-hidden />
      )}

      {frozen ? (
        <button
          type="button"
          onClick={onResume}
          aria-label="Resume live view"
          className="flex size-18 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur active:scale-95"
        >
          <X className="size-7" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onCapture}
          disabled={!canCapture}
          aria-label="Capture frame"
          className="flex size-18 items-center justify-center rounded-full border-4 border-white transition active:scale-90 disabled:opacity-40"
        >
          <span className="size-13 rounded-full bg-white" />
        </button>
      )}

      {canType && (
        <button
          type="button"
          onClick={onType}
          aria-label="Ask a follow-up question"
          className="flex size-12 items-center justify-center rounded-full bg-white/15 backdrop-blur active:scale-95"
        >
          <Keyboard className="size-5" />
        </button>
      )}

      {canClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear annotations"
          className="flex size-12 items-center justify-center rounded-full bg-white/15 backdrop-blur active:scale-95"
        >
          <Eraser className="size-5" />
        </button>
      ) : (
        // Keeps the shutter centered.
        <span className="size-12" aria-hidden />
      )}
    </div>
  )
}
