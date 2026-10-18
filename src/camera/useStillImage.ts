import { useCallback, useRef, useState } from 'react'
import type { Size } from './geometry'
import type { CameraStatus } from './useCameraStream'

/**
 * Still-image stand-in for the camera (`?image=<url>`): the image is shown
 * with object-fit: cover and captured through the same crop/letterbox path,
 * so desktop testing and e2e tests exercise the real pipeline.
 */
export function useStillImage(url: string | null) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [status, setStatus] = useState<CameraStatus>(url ? 'requesting' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [videoSize, setVideoSize] = useState<Size | null>(null)

  const onLoad = useCallback(() => {
    const img = imageRef.current
    if (!img) return
    setVideoSize({ width: img.naturalWidth, height: img.naturalHeight })
    setStatus('live')
  }, [])

  const onError = useCallback(() => {
    setStatus('error')
    setError(`Could not load the test image ${url}`)
  }, [url])

  const restart = useCallback(() => {
    const img = imageRef.current
    if (img && url) img.src = url
  }, [url])

  return { imageRef, status, error, videoSize, restart, onLoad, onError }
}
