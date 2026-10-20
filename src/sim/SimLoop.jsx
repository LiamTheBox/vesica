import { useFrame } from '@react-three/fiber'
import { tick } from './engine'

// Steps the simulation once per rendered frame, before the organ draws (it mounts first).
export function SimLoop() {
  useFrame((_, delta) => tick(Math.min(0.08, delta)))
  return null
}
