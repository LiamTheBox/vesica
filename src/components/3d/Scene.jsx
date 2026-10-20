import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Organ from './Organ'
import { SimLoop } from '../../sim/SimLoop'
import { selectQualityTier, useUiStore } from '../../store/useUiStore'
import { QUALITY_TIERS } from '../../settings/quality'
import { DevBridge } from '../../debug/DevBridge'
import { StageFit } from './StageFit'
import { QualityMonitor } from './QualityMonitor'

export default function Scene() {
  const mode = useUiStore((s) => s.interactionMode)
  const tier = useUiStore(selectQualityTier)
  // In the background nothing renders and the simulation (stepped per frame) waits.
  const hidden = useUiStore((s) => s.appHidden)

  return (
    <div className="absolute inset-0 z-0" data-quality={tier}>
      {/* Starts at the original's camera angle; StageFit sets the distance. */}
      <Canvas
        camera={{ position: [0, 1.71, 11.88], fov: 45 }}
        dpr={[1, QUALITY_TIERS[tier].maxDpr]}
        frameloop={hidden ? 'never' : 'always'}
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
        <StageFit />
        <QualityMonitor />
        <Organ />

        {/* One finger/left button uses the current tool; Orbit mode rotates instead.
            Two fingers zoom and rotate in any tool except Squeeze, where a pinch squeezes. */}
        <OrbitControls
          makeDefault
          enablePan={false}
          mouseButtons={{ LEFT: mode === 'orbit' ? THREE.MOUSE.ROTATE : null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null }}
          touches={{ ONE: mode === 'orbit' ? THREE.TOUCH.ROTATE : null, TWO: mode === 'squeeze' ? null : THREE.TOUCH.DOLLY_ROTATE }}
          maxPolarAngle={Math.PI / 1.5}
        />
      </Canvas>
    </div>
  )
}
