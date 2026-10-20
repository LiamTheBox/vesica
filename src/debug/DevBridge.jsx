import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

// Dev-only: lets tests reach the R3F scene (camera, controls) via `window.__vesica.three()`.
export function DevBridge() {
  const get = useThree((state) => state.get)
  useEffect(() => {
    if (window.__vesica) window.__vesica.three = get
  }, [get])
  return null
}
