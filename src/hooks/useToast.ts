import { useCallback, useEffect, useRef, useState } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  text: string
  tone: 'info' | 'error'
  action?: ToastAction
}

export function useToast(durationMs = 3500) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const show = useCallback(
    (text: string, tone: Toast['tone'] = 'error', action?: ToastAction) => {
      clearTimeout(timerRef.current)
      setToast({ text, tone, action })
      // Give people time to reach an action button.
      timerRef.current = setTimeout(() => setToast(null), action ? durationMs * 2 : durationMs)
    },
    [durationMs],
  )

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return [toast, show, dismiss] as const
}
