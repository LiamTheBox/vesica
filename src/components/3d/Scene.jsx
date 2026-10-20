import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Organ from './Organ'
import { SimLoop } from '../../sim/SimLoop'
import { useUiStore } from '../../store/useUiStore'
import { DevBridge } from '../../debug/DevBridge'

export default function Scene() {
  const mode = useUiStore((s) => s.interactionMode)

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', localClippingEnabled: true }}
      >
        <color attach="background" args={['#060913']} />
        <fogExp2 attach="fog" args={['#060913', 0.038]} />

        <ambientLight color={0x334155} intensity={2.2} />
        <directionalLight color={0xfff1e6} intensity={2.6} position={[6, 12, 8]} />
        <directionalLight color={0x38bdf8} intensity={3.0} position={[-8, -4, -8]} />
        <pointLight color={0xf59e0b} intensity={5.0} distance={10} position={[0, -0.2, 0]} />

        {import.meta.env.DEV && <DevBridge />}
        <SimLoop />
        <Organ />
        
        <OrbitControls
          makeDefault
          enablePan={false} 
          enableRotate={mode === 'orbit'}
          minDistance={7} 
          maxDistance={22}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  )
}
