import { useCallback, useEffect, useRef, useState } from 'react'
import type { Size } from './geometry'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported' | 'error'

const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
}

async function openStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(PREFERRED_CONSTRAINTS)
  } catch (err) {
    // Desktops often lack a rear camera or the requested resolution.
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'OverconstrainedError' || name === 'NotFoundError') {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    }
    throw err
  }
}

function describeError(err: unknown): { status: CameraStatus; message: string } {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'denied', message: 'Camera access was blocked.' }
    case 'NotFoundError':
      return { status: 'error', message: 'No camera was found on this device.' }
    case 'NotReadableError':
      return { status: 'error', message: 'The camera is in use by another app.' }
    default:
      return { status: 'error', message: err instanceof Error ? err.message : 'Could not start the camera.' }
  }
}

/** Live rear-camera stream. `enabled: false` never requests the camera (e.g. still-image mode). */
export function useCameraStream(enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Bumped on every start/stop so stale async requests can bail out.
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [videoSize, setVideoSize] = useState<Size | null>(null)

  const stop = useCallback(() => {
    requestIdRef.current++
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async () => {
    stop()
    const id = requestIdRef.current

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      setError(
        window.isSecureContext
          ? 'This browser does not support camera access.'
          : 'Camera access requires HTTPS. Open this page over https://.',
      )
      return
    }

    setStatus('requesting')
    setError(null)
    try {
      const stream = await openStream()
      if (id !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      performance.mark('camera:granted')
      streamRef.current = stream
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (id !== requestIdRef.current) return
        setStatus('error')
        setError('The camera stream ended unexpectedly.')
      })

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      if (id !== requestIdRef.current) return

      performance.mark('camera:live')
      const { duration } = performance.measure('camera:init', 'camera:granted', 'camera:live')
      console.info(`[camera] live in ${duration.toFixed(0)} ms after permission grant`)
      setVideoSize({ width: video.videoWidth, height: video.videoHeight })
      setStatus('live')
    } catch (err) {
      if (id !== requestIdRef.current) return
      const { status, message } = describeError(err)
      setStatus(status)
      setError(message)
    }
  }, [stop])

  useEffect(() => {
    if (!enabled) return
    // Starting the camera is the external sync this effect exists for.
    // oxlint-disable-next-line react/set-state-in-effect
    void start()

    // iOS kills background streams anyway; releasing explicitly also saves battery.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop()
        setStatus('idle')
      } else {
        void start()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stop()
    }
  }, [enabled, start, stop])

  return { videoRef, status, error, videoSize, restart: start }
}
