import type { Ref } from 'react'

const FILL = 'fixed inset-0 h-dvh w-screen bg-black object-cover'

interface ViewfinderProps {
  videoRef: Ref<HTMLVideoElement>
  /** Still-image mode: show this image instead of the camera. */
  imageUrl?: string | null
  imageRef?: Ref<HTMLImageElement>
  onImageLoad?: () => void
  onImageError?: () => void
}

export function Viewfinder({ videoRef, imageUrl, imageRef, onImageLoad, onImageError }: ViewfinderProps) {
  if (imageUrl) {
    return (
      <img
        ref={imageRef}
        src={imageUrl}
        alt=""
        onLoad={onImageLoad}
        onError={onImageError}
        className={FILL}
        crossOrigin="anonymous"
      />
    )
  }
  return <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture className={FILL} />
}
