import { useEffect, useState } from 'react'
import type { Size } from '../camera/geometry'

function read(): Size {
  return { width: window.innerWidth, height: window.innerHeight }
}

export function useViewport(): Size {
  const [size, setSize] = useState(read)

  useEffect(() => {
    const update = () => setSize(read())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return size
}
