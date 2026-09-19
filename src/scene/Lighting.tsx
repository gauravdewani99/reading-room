import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as THREE from 'three'
import { useStore, env } from '../store'

/** Three-stop mix: a at t=0 (day), b at t=0.5 (sunset/sunrise), c at t=1 (night). */
export const mix3 = (t: number, a: number, b: number, c: number) => (t < 0.5 ? THREE.MathUtils.lerp(a, b, t * 2) : THREE.MathUtils.lerp(b, c, (t - 0.5) * 2))
const C = (s: string) => new THREE.Color(s)
export const PALETTE = {
  bg: [C('#d8cdbf'), C('#c98a5e'), C('#0e0b10')],
  sun: [C('#fff3d8'), C('#ff9548'), C('#ff6a3a')],
  ambient: [C('#fff1dc'), C('#ffb98a'), C('#3b4a7a')],
  sky: [C('#e9f1ff'), C('#ffc79a'), C('#0b1230')],
}
export const mixColor = (out: THREE.Color, t: number, [a, b, c]: THREE.Color[]) =>
  t < 0.5 ? out.lerpColors(a, b, t * 2) : out.lerpColors(b, c, (t - 0.5) * 2)

export function Lighting() {
  const mode = useStore((s) => s.mode)
  const sun = useRef<THREE.DirectionalLight>(null!)
  const hemi = useRef<THREE.HemisphereLight>(null!)
  const amb = useRef<THREE.AmbientLight>(null!)
  const { scene, gl } = useThree()

  // soft image-based lighting so glossy jackets and glass have something to reflect
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.1
    return () => { env.dispose(); pmrem.dispose(); scene.environment = null }
  }, [gl, scene])
  const sunTarget = useMemo(() => { const o = new THREE.Object3D(); o.position.set(-0.5, 0.4, -0.5); return o }, [])

  useFrame((_, dt) => {
    // ~15s sunrise/sunset
    env.night = THREE.MathUtils.damp(env.night, mode === 'night' ? 1 : 0, 0.28, dt)
    const t = env.night
    // sun arc: high at noon → low on the horizon at sunset → below it at night; azimuth swings so the patch sweeps the floor
    const el = THREE.MathUtils.degToRad(mix3(t, 46, 7, -14))
    const az = THREE.MathUtils.degToRad(mix3(t, 12, 48, 75))
    env.sunPos.set(-Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(12)
    env.sunEl = el
    sun.current.position.copy(env.sunPos).add(sunTarget.position)
    const above = THREE.MathUtils.smoothstep(el, -0.02, 0.12)
    sun.current.intensity = mix3(t, 6.5, 3.5, 0) * above
    mixColor(sun.current.color, t, PALETTE.sun)
    hemi.current.intensity = mix3(t, 1.5, 0.8, 0.16)
    mixColor(hemi.current.color, t, PALETTE.sky)
    amb.current.intensity = mix3(t, 0.6, 0.35, 0.1)
    mixColor(amb.current.color, t, PALETTE.ambient)
    const bg = scene.background as THREE.Color
    mixColor(bg, t, PALETTE.bg)
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(bg)
  })

  return (
    <>
      <color attach="background" args={['#0e0b10']} />
      <fog attach="fog" args={['#0e0b10', 7, 16]} />
      <primitive object={sunTarget} />
      <ambientLight ref={amb} />
      <hemisphereLight ref={hemi} groundColor="#5a4030" />
      <directionalLight ref={sun} target={sunTarget} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.02}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={1} shadow-camera-far={30} />
    </>
  )
}
