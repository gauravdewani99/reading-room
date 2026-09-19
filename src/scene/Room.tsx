import { useMemo, useRef, Suspense } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, env } from '../store'
import { Text } from '@react-three/drei'
import { SIDE_TABLE, BOOKCASE, CHAIR_DISPLAY as DISPLAY, SHELF_DISPLAY, CHAIR, DECK, ROOM } from './layout'
import { RoundedBox } from '@react-three/drei'
import { mix3, mixColor, PALETTE } from './Lighting'
import { MISSING_COVER } from './Book'
import { TRACKS } from '../beats'
import { LABEL } from './Bookcase'

const wood = (c: string) => <meshStandardMaterial color={c} roughness={0.8} />
const damp = THREE.MathUtils.damp
const SKYLIGHT = { x: 0.4, z: -1.0, w: 1.1 }
const WALL = [new THREE.Color('#9a877a'), new THREE.Color('#7a5548'), new THREE.Color('#382b2b')]
const CEIL = [new THREE.Color('#a4948a'), new THREE.Color('#6a4a40'), new THREE.Color('#1a1416')]
// the floor tint multiplies the plank texture, so these sit lighter than the flat colours did
const FLOOR = [new THREE.Color('#c9a27e'), new THREE.Color('#a87a5c'), new THREE.Color('#6b4d3c')]

/** A material whose colour follows the day → sunset → night cycle. */
function CycleMaterial({ stops, roughness = 1, map, roughnessMap }:
  { stops: THREE.Color[]; roughness?: number; map?: THREE.Texture; roughnessMap?: THREE.Texture }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(() => mixColor(ref.current.color, env.night, stops))
  return <meshStandardMaterial ref={ref} roughness={roughness} map={map} roughnessMap={roughnessMap} />
}

/**
 * Oak floorboards drawn to canvas: a 2 m tile of staggered planks running front-to-back, each with
 * its own tone, fine grain and a dark seam. Returns colour + roughness maps set to tile the 8 m floor.
 */
function plankMaps() {
  const S = 1024, TILE = 2, W = 0.167, COLS = Math.round(TILE / W)
  const c = document.createElement('canvas'); c.width = c.height = S
  const ctx = c.getContext('2d')!
  const r = document.createElement('canvas'); r.width = r.height = S
  const rx = r.getContext('2d')!
  const pw = S / COLS
  const rnd = (a: number, b: number) => a + Math.random() * (b - a)
  for (let col = 0; col < COLS; col++) {
    // staggered joints: each column is a run of planks of varying length starting at a random offset
    let y = -rnd(0, 0.9) * S * 0.5
    while (y < S) {
      const len = rnd(0.45, 0.95) * S * 0.6
      const tone = rnd(-14, 14), hue = rnd(-4, 4)
      ctx.fillStyle = `hsl(${30 + hue} 42% ${58 + tone}%)`
      ctx.fillRect(col * pw, y, pw, len)
      // grain: long faint streaks along the plank
      for (let i = 0; i < 26; i++) {
        const gx = col * pw + rnd(2, pw - 2), light = Math.random() > 0.5
        ctx.strokeStyle = light ? `rgba(255,236,205,${rnd(0.05, 0.16)})` : `rgba(60,32,14,${rnd(0.05, 0.16)})`
        ctx.lineWidth = rnd(0.6, 2.2)
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.bezierCurveTo(gx + rnd(-4, 4), y + len * 0.3, gx + rnd(-4, 4), y + len * 0.7, gx + rnd(-3, 3), y + len); ctx.stroke()
      }
      // end seam
      ctx.fillStyle = 'rgba(40,22,10,0.75)'; ctx.fillRect(col * pw, y + len - 1.5, pw, 3)
      // roughness: satin varnish, a touch glossier per plank and dull in the seams
      rx.fillStyle = `hsl(0 0% ${rnd(58, 70)}%)`
      rx.fillRect(col * pw, y, pw, len)
      rx.fillStyle = '#fff'; rx.fillRect(col * pw, y + len - 1.5, pw, 3)
      y += len
    }
    // side seam with a bevel highlight
    ctx.fillStyle = 'rgba(40,22,10,0.8)'; ctx.fillRect(col * pw - 1.5, 0, 3, S)
    ctx.fillStyle = 'rgba(255,240,215,0.14)'; ctx.fillRect(col * pw + 1.5, 0, 1.5, S)
    rx.fillStyle = '#fff'; rx.fillRect(col * pw - 1.5, 0, 3, S)
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace
  const rough = new THREE.CanvasTexture(r)
  for (const t of [map, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8 / TILE, 8 / TILE); t.anisotropy = 16 }
  return { map, rough }
}

export function Room() {
  return (
    <group>
      <Floor />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.005, -1.2]} receiveShadow>
        <circleGeometry args={[1.9, 48]} />
        <meshStandardMaterial color="#7a3b2e" roughness={1} />
      </mesh>
      {/* back wall with a window behind the chair */}
      <WallWithOpening position={[0, 1.6, -3.05]} rotation={[0, 0, 0]} size={[8, 3.2]} hole={[1.7, 0.3, 1.25, 1.45]} />
      {/* left wall with the big window */}
      <WallWithOpening position={[-ROOM.halfWidth, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} size={[8, 3.2]} hole={[-1.1, 0.15, 1.5, 1.7]} />
      {/* right wall */}
      <mesh position={[ROOM.halfWidth, 1.6, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[8, 3.2]} />
        <CycleMaterial stops={WALL} />
      </mesh>
      {/* ceiling with a skylight over the rug */}
      <WallWithOpening position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]} size={[8, 8]} hole={[SKYLIGHT.x, SKYLIGHT.z, SKYLIGHT.w, SKYLIGHT.w]} stops={CEIL} />
      <Window position={[-ROOM.halfWidth + 0.03, 1.75, 1.1]} rotation={[0, Math.PI / 2, 0]} size={[1.5, 1.7]} />
      <Window position={[1.7, 1.9, -3.02]} rotation={[0, 0, 0]} size={[1.25, 1.45]} />
      <Window position={[SKYLIGHT.x, 3.18, SKYLIGHT.z]} rotation={[Math.PI / 2, 0, 0]} size={[SKYLIGHT.w, SKYLIGHT.w]} sill={false} />
      <SunShafts aperture={[-ROOM.halfWidth + 0.03, 1.75, 1.1]} radius={0.7} beams={9} />
      <SunShafts aperture={[SKYLIGHT.x, 3.18, SKYLIGHT.z]} radius={0.5} beams={8} />
      <ShelfLight />
      <DisplayLight />
      <Chair />
      <SideTable />
      <Lamp />
      <Deck />
      <Stars />
    </group>
  )
}

function Floor() {
  const { map, rough } = useMemo(plankMaps, [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[8, 8]} />
      <CycleMaterial stops={FLOOR} roughness={1} map={map} roughnessMap={rough} />
    </mesh>
  )
}

/** Wall built from four slabs so light and shadow pass through the opening. */
function WallWithOpening({ position, rotation, size: [W, H], hole: [cx, cy, w, h], stops = WALL }:
  { position: [number, number, number]; rotation: [number, number, number]; size: [number, number]; hole: [number, number, number, number]; stops?: THREE.Color[] }) {
  const T = 0.12
  const slabs: [number, number, number, number][] = [
    [(-W / 2 + (cx - w / 2)) / 2, 0, cx - w / 2 + W / 2, H],                   // left of hole
    [(W / 2 + (cx + w / 2)) / 2, 0, W / 2 - (cx + w / 2), H],                   // right of hole
    [cx, (cy + h / 2 + H / 2) / 2, w, H / 2 - (cy + h / 2)],                    // above
    [cx, (cy - h / 2 - H / 2) / 2, w, cy - h / 2 + H / 2],                      // below
  ]
  return (
    <group position={position} rotation={rotation}>
      {slabs.map(([x, y, sw, sh], i) => (
        <mesh key={i} position={[x, y, -T / 2]} castShadow receiveShadow>
          <boxGeometry args={[sw, sh, T]} />
          <CycleMaterial stops={stops} />
        </mesh>
      ))}
    </group>
  )
}

function rayTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(0.9, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256)
  return new THREE.CanvasTexture(c)
}

function Window({ position, rotation, size: [w, h], sill = true }:
  { position: [number, number, number]; rotation: [number, number, number]; size: [number, number]; sill?: boolean }) {
  const pane = useRef<THREE.MeshBasicMaterial>(null!)
  const tmp = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const t = env.night
    mixColor(tmp, t, PALETTE.sky)
    // unlit glass: bright sky by day, deep midnight blue at night, never catches a lamp
    pane.current.color.copy(tmp).multiplyScalar(mix3(t, 2.2, 1.4, 0.55))
  })
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.03]}><boxGeometry args={[w + 0.14, h + 0.14, 0.05]} /><meshStandardMaterial color="#2a201c" /></mesh>
      <mesh><planeGeometry args={[w, h]} /><meshBasicMaterial ref={pane} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.01]}><boxGeometry args={[0.04, h, 0.02]} /><meshStandardMaterial color="#2a201c" /></mesh>
      <mesh position={[0, 0, 0.01]}><boxGeometry args={[w, 0.04, 0.02]} /><meshStandardMaterial color="#2a201c" /></mesh>
      {sill && <mesh position={[0, -h / 2 - 0.07, 0.06]} castShadow><boxGeometry args={[w + 0.3, 0.05, 0.16]} /><meshStandardMaterial color="#2a201c" /></mesh>}
    </group>
  )
}

/**
 * Visible sun rays: a bundle of thin additive cones plus drifting dust, aimed from an
 * aperture (window / skylight) along the live sun direction. Fades with the sun.
 */
function SunShafts({ aperture, radius, beams }: { aperture: [number, number, number]; radius: number; beams: number }) {
  const group = useRef<THREE.Group>(null!)
  const dust = useRef<THREE.Group>(null!)
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const dustMat = useRef<THREE.PointsMaterial>(null!)
  const alpha = useMemo(rayTexture, [])
  const world = useMemo(() => new THREE.Vector3(...aperture), [aperture])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const LEN = 5.5
  const rays = useMemo(() => Array.from({ length: beams }, (_, i) => {
    const a = (i / beams) * Math.PI * 2 + Math.random() * 0.5
    const r = radius * (0.25 + Math.random() * 0.7)
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, w: 0.03 + Math.random() * 0.07, len: LEN * (0.7 + Math.random() * 0.3) }
  }), [beams, radius])
  const dustGeo = useMemo(() => {
    const n = 220, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const s = Math.random() * LEN * 0.85, a = Math.random() * Math.PI * 2, r = Math.random() * (radius + s * 0.12)
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = s; pos[i * 3 + 2] = Math.sin(a) * r
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g
  }, [radius])

  useFrame(({ clock }) => {
    dir.copy(world).sub(env.sunPos).normalize()
    q.setFromUnitVectors(UP, dir)
    group.current.quaternion.copy(q)
    const t = env.night
    const strength = (1 - t) * THREE.MathUtils.smoothstep(env.sunEl, 0.04, 0.35)
    for (const m of mats.current) { if (m) { m.opacity = 0.085 * strength; mixColor(m.color, t, PALETTE.sun) } }
    dustMat.current.opacity = 0.55 * strength
    dust.current.rotation.y = clock.elapsedTime * 0.05
    dust.current.position.y = Math.sin(clock.elapsedTime * 0.3) * 0.08
  })

  return (
    <group ref={group} position={aperture}>
      <mesh position={[0, LEN / 2, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius * 1.6, LEN, 24, 1, true]} />
        <meshBasicMaterial ref={(m) => { if (m) mats.current[0] = m }} transparent opacity={0} alphaMap={alpha} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {rays.map((r, i) => (
        <mesh key={i} position={[r.x, r.len / 2, r.z]}>
          <cylinderGeometry args={[r.w, r.w * 1.8, r.len, 8, 1, true]} />
          <meshBasicMaterial ref={(m) => { if (m) mats.current[i + 1] = m }} transparent opacity={0} alphaMap={alpha} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group ref={dust}>
        <points geometry={dustGeo}>
          <pointsMaterial ref={dustMat} color="#fff3d6" size={0.018} transparent opacity={0} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
    </group>
  )
}

/** Soft key light that fades in on a picked-up book so its cover reads at night. */
function DisplayLight() {
  const light = useRef<THREE.PointLight>(null!)
  const shelf = useStore((s) => s.books.find((b) => b.id === s.selectedId)?.shelf)
  useFrame((_, dt) => {
    const at = shelf === 'current' ? DISPLAY : SHELF_DISPLAY
    const l = light.current
    l.position.set(at.x + 0.25, at.y + 0.45, at.z + 0.75)
    l.intensity = damp(l.intensity, shelf ? 1.6 - 0.9 * (1 - env.night) : 0, 6, dt)
  })
  return <pointLight ref={light} color="#ffe2bd" intensity={0} distance={3} decay={2} />
}

/**
 * One fixture family for the whole room: a matte dome shade on a lathe profile, lined warm inside,
 * with a real bulb in the mouth. The lining and bulb brighten as night falls. Origin is the centre
 * of the shade's mouth; the shade rises above it.
 */
function DomeShade({ radius = 0.2, height = 0.16 }: { radius?: number; height?: number }) {
  const lining = useRef<THREE.MeshStandardMaterial>(null!)
  const bulb = useRef<THREE.MeshStandardMaterial>(null!)
  const shell = useMemo(() => {
    const r = radius, h = height
    const pts = [
      new THREE.Vector2(0.016, h + 0.012), new THREE.Vector2(0.034, h), new THREE.Vector2(r * 0.42, h * 0.86),
      new THREE.Vector2(r * 0.78, h * 0.5), new THREE.Vector2(r * 0.97, h * 0.14), new THREE.Vector2(r, 0),
    ]
    return new THREE.LatheGeometry(pts, 48)
  }, [radius, height])
  useFrame(() => {
    const t = env.night
    lining.current.emissiveIntensity = 0.06 + 0.5 * t
    bulb.current.emissiveIntensity = 0.35 + 2.4 * t
  })
  return (
    <group>
      <mesh geometry={shell} castShadow>
        <meshStandardMaterial color="#27272b" roughness={0.55} metalness={0.15} />
      </mesh>
      {/* inner lining: the same dome, seen from inside, a touch smaller so it sits within the shell */}
      <mesh geometry={shell} scale={[0.965, 0.965, 0.965]} position={[0, 0.002, 0]}>
        <meshStandardMaterial ref={lining} color="#e9d6b6" roughness={0.9} side={THREE.BackSide} emissive="#ffb870" emissiveIntensity={0.06} />
      </mesh>
      {/* socket cap + bulb */}
      <mesh position={[0, height * 0.7, 0]}><cylinderGeometry args={[0.018, 0.018, 0.05, 16]} /><meshStandardMaterial color="#8a8a8e" metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={[0, height * 0.42, 0]}><sphereGeometry args={[0.024, 20, 16]} /><meshStandardMaterial ref={bulb} color="#fff4de" emissive="#ffe6bf" emissiveIntensity={0.35} roughness={0.2} /></mesh>
      {/* a thin rim gives the mouth some material thickness */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius - 0.004, 0.005, 8, 48]} /><meshStandardMaterial color="#27272b" roughness={0.55} metalness={0.15} /></mesh>
    </group>
  )
}

/**
 * A dome pendant on a braided fabric cord from a ceiling canopy. The cord is warm-toned and thick
 * enough to catch the lamp's own light, so the shade visibly hangs from something. `position` is the mouth of the shade.
 */
function Pendant({ position: [x, y, z], radius, height = 0.16, ceiling = 3.2 }:
  { position: [number, number, number]; radius: number; height?: number; ceiling?: number }) {
  const top = y + height + 0.012
  const metal = <meshStandardMaterial color="#27272b" roughness={0.5} metalness={0.2} />
  return (
    <group position={[x, 0, z]}>
      {/* canopy: a shallow dome against the ceiling with a small collar */}
      <mesh position={[0, ceiling, 0]} rotation={[Math.PI, 0, 0]}><sphereGeometry args={[0.07, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />{metal}</mesh>
      <mesh position={[0, ceiling - 0.075, 0]}><cylinderGeometry args={[0.014, 0.014, 0.03, 12]} />{metal}</mesh>
      {/* braided cord */}
      <mesh position={[0, (ceiling + top) / 2, 0]} castShadow><cylinderGeometry args={[0.0085, 0.0085, ceiling - top, 10]} /><meshStandardMaterial color="#7d6a56" roughness={0.9} /></mesh>
      {/* strain relief where the cord enters the shade */}
      <mesh position={[0, top + 0.012, 0]}><cylinderGeometry args={[0.012, 0.016, 0.035, 12]} />{metal}</mesh>
      <group position={[0, y, 0]}><DomeShade radius={radius} height={height} /></group>
    </group>
  )
}

/**
 * Pendant over the bookcase. Its wash is the call to action from across the room; at the shelf
 * (or with a book out) it settles so spine colours and titles stay readable.
 */
function ShelfLight() {
  const wash = useRef<THREE.SpotLight>(null!)
  const fill = useRef<THREE.PointLight>(null!)
  const near = useStore((s) => s.focus === 'shelf' || s.selectedId !== null)
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(BOOKCASE.x, 0.9, BOOKCASE.z + 0.1); return o }, [])
  const lampY = 2.6, lampZ = BOOKCASE.z + 0.8
  useFrame((_, dt) => {
    const glow = near ? 1 : 1.45
    wash.current.intensity = damp(wash.current.intensity, (0.8 + 3.4 * env.night) * glow, 2, dt)
    fill.current.intensity = damp(fill.current.intensity, (0.06 + 0.28 * env.night) * glow, 2, dt)
  })
  return (
    <group position={[BOOKCASE.x, 0, lampZ]}>
      <primitive object={target} />
      <Pendant position={[0, lampY, 0]} radius={0.21} height={0.17} />
      <spotLight ref={wash} position={[0, lampY + 0.03, 0]} target={target} color="#ffd6a6" angle={0.72} penumbra={0.9} distance={5} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      {/* soft fill so the top plank and the label never sit in shadow */}
      <pointLight ref={fill} position={[0, lampY - 0.08, 0.05]} color="#ffd6a6" distance={2.4} decay={2} />
    </group>
  )
}

/** A long smooth chaise: a rounded profile swept across its width, with splayed wooden legs. */
function Chair() {
  const setFocus = useStore((s) => s.setFocus)
  const FABRIC = '#3f5f63', WIDTH = 0.8, THICK = 0.17
  const profile = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.18, -0.86), new THREE.Vector3(0, 1.02, -0.86), new THREE.Vector3(0, 0.78, -0.72), new THREE.Vector3(0, 0.55, -0.5),
    new THREE.Vector3(0, 0.44, -0.2), new THREE.Vector3(0, 0.43, 0.2), new THREE.Vector3(0, 0.47, 0.6), new THREE.Vector3(0, 0.42, 0.88), new THREE.Vector3(0, 0.3, 0.98),
  ]), [])
  const body = useMemo(() => {
    // side profile as a 2D shape: the top curve, then the same curve pushed down by the cushion thickness
    const pts = profile.getSpacedPoints(48)
    const top: THREE.Vector2[] = [], bottom: THREE.Vector2[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
      const tz = b.z - a.z, ty = b.y - a.y, len = Math.hypot(tz, ty) || 1
      const nz = -ty / len, ny = tz / len
      top.push(new THREE.Vector2(pts[i].z, pts[i].y))
      bottom.push(new THREE.Vector2(pts[i].z - nz * THICK, pts[i].y - ny * THICK))
    }
    const shape = new THREE.Shape([...top, ...bottom.reverse()])
    const g = new THREE.ExtrudeGeometry(shape, { depth: WIDTH - 0.09, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045, bevelSegments: 4, curveSegments: 12 })
    g.rotateY(-Math.PI / 2); g.translate(WIDTH / 2 - 0.045, 0, 0)
    g.computeVertexNormals()
    return g
  }, [profile])
  const pillowAt = useMemo(() => profile.getPointAt(0.3), [profile])
  const pillowTan = useMemo(() => profile.getTangentAt(0.3), [profile])
  return (
    <group position={[CHAIR.x, 0, CHAIR.z]} rotation={[0, CHAIR.ry, 0]}
      onClick={(e) => { e.stopPropagation(); setFocus('chair') }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
      <mesh geometry={body} castShadow receiveShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.95} />
      </mesh>
      {/* lumbar pillow */}
      <RoundedBox args={[0.5, 0.27, 0.1]} radius={0.04} smoothness={3} position={[0, pillowAt.y + 0.08, pillowAt.z + 0.07]} rotation={[-Math.atan2(pillowTan.y, pillowTan.z) + Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#c9a24d" roughness={1} />
      </RoundedBox>
      {/* blanket over the foot end */}
      <RoundedBox args={[0.55, 0.05, 0.42]} radius={0.02} position={[-0.12, 0.5, 0.72]} rotation={[0.05, 0.2, 0.06]} castShadow>
        <meshStandardMaterial color="#d9c3a3" roughness={1} />
      </RoundedBox>
      <mesh position={[-0.42, 0.28, 0.72]} rotation={[0, 0.2, 0.05]} castShadow><boxGeometry args={[0.05, 0.42, 0.4]} /><meshStandardMaterial color="#d9c3a3" roughness={1} /></mesh>
      {/* splayed light-wood legs */}
      {[[-0.3, -0.5, -0.25, -0.2], [0.3, -0.5, 0.25, -0.2], [-0.3, 0.55, -0.25, 0.2], [0.3, 0.55, 0.25, 0.2]].map(([x, z, tx, tz], i) => (
        <mesh key={i} position={[x, 0.18, z]} rotation={[tz, 0, -tx]} castShadow>
          <cylinderGeometry args={[0.018, 0.026, 0.38, 12]} />
          <meshStandardMaterial color="#c9a06a" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function SideTable() {
  const books = useStore((s) => s.books)
  const current = useMemo(() => books.filter((b) => b.shelf === 'current').slice(0, 3), [books])
  const { x, y, z } = SIDE_TABLE
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y - 0.015, 0]} castShadow receiveShadow><cylinderGeometry args={[0.28, 0.28, 0.03, 32]} />{wood('#5a3d2b')}</mesh>
      <mesh position={[0, y / 2, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, y, 12]} />{wood('#3f2a1d')}</mesh>
      <mesh position={[0, 0.015, 0]} castShadow><cylinderGeometry args={[0.2, 0.2, 0.03, 32]} />{wood('#3f2a1d')}</mesh>
      <Candle position={[0.18, y, -0.13]} />
      {/* label, same styling as the bookcase labels, floating above the stack */}
      <pointLight position={[-0.05, y + 0.55, 0.25]} color="#ffd9a6" intensity={1.4} distance={1.4} decay={2} />
      <Text position={[-0.06, y + 0.06 + current.length * 0.04 + 0.22, 0.05]} anchorX="center" {...LABEL}>
        CURRENTLY READING
      </Text>
      {current.map((b, i) => (
        <Suspense key={b.id} fallback={null}><CurrentBook cover={b.cover} id={b.id} index={i} /></Suspense>
      ))}
    </group>
  )
}

/** A book in the stack on the side table. Picking it up presents it exactly like a shelf book. */
function CurrentBook({ cover, id, index }: { cover: string | null; id: string; index: number }) {
  const tex = useLoader(THREE.TextureLoader, cover ?? MISSING_COVER)
  tex.colorSpace = THREE.SRGBColorSpace
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const hovered = useStore((s) => s.hoveredId === id)
  const selected = useStore((s) => s.selectedId === id)
  const ref = useRef<THREE.Group>(null!)
  const THICK = 0.035
  // stacked flat, each one nudged and turned a little so it reads as a casual pile
  const REST = { x: -0.07 + index * 0.012, y: SIDE_TABLE.y + THICK / 2 + index * (THICK + 0.004), z: 0.05 - index * 0.01, rx: -Math.PI / 2, ry: 0.12 - index * 0.32 }
  useFrame((_, dt) => {
    const g = ref.current
    g.rotation.order = 'YXZ'
    const tx = selected ? DISPLAY.x - SIDE_TABLE.x : REST.x
    const ty = selected ? DISPLAY.y : REST.y + (hovered ? 0.04 : 0)
    const tz = selected ? DISPLAY.z - SIDE_TABLE.z : REST.z
    const k = selected ? 5 : 8
    g.position.set(damp(g.position.x, tx, k, dt), damp(g.position.y, ty, k, dt), damp(g.position.z, tz, k, dt))
    g.rotation.set(damp(g.rotation.x, selected ? 0 : REST.rx, k, dt), damp(g.rotation.y, selected ? 0 : REST.ry, k, dt), 0)
    g.scale.setScalar(damp(g.scale.x, selected ? 1.5 : 1, k, dt))
  })
  return (
    <group ref={ref} position={[REST.x, REST.y, REST.z]} rotation={[REST.rx, REST.ry, 0]}
      onPointerOver={(e) => { e.stopPropagation(); hover(id); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { hover(null); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); select(selected ? null : id) }}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.3, THICK]} />
        {[0, 1, 2, 3].map((i) => <meshStandardMaterial key={i} attach={`material-${i}`} color="#efe6d2" />)}
        <meshStandardMaterial attach="material-4" map={tex} roughness={0.55} />
        <meshStandardMaterial attach="material-5" color="#2b2b2b" />
      </mesh>
    </group>
  )
}

/** Arc floor lamp behind the chair: weighted base, pole, a swept arm, and the same dome shade over the side table. */
function Lamp() {
  const spot = useRef<THREE.SpotLight>(null!)
  const bulb = useRef<THREE.PointLight>(null!)
  const BASE: [number, number, number] = [2.4, 0, -2.25]
  const SHADE = { x: SIDE_TABLE.x + 0.22 - BASE[0], y: 1.5, z: SIDE_TABLE.z + 0.1 - BASE[2] }
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(SIDE_TABLE.x, SIDE_TABLE.y, SIDE_TABLE.z); return o }, [])
  const arm = useMemo(() => {
    const top = SHADE.y + 0.17 + 0.06
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.9, 0), new THREE.Vector3(SHADE.x * 0.42, top + 0.28, SHADE.z * 0.42), new THREE.Vector3(SHADE.x, top, SHADE.z))
    return new THREE.TubeGeometry(curve, 40, 0.011, 12, false)
  }, [SHADE.x, SHADE.y, SHADE.z])
  useFrame(() => {
    const t = env.night
    spot.current.intensity = 1.0 + 6.5 * t
    bulb.current.intensity = 0.08 + 0.7 * t
  })
  const metal = <meshStandardMaterial color="#27272b" metalness={0.5} roughness={0.45} />
  return (
    <group position={BASE}>
      <primitive object={target} />
      <mesh position={[0, 0.012, 0]} castShadow><cylinderGeometry args={[0.2, 0.21, 0.024, 40]} />{metal}</mesh>
      <mesh position={[0, 0.95, 0]} castShadow><cylinderGeometry args={[0.011, 0.014, 1.9, 12]} />{metal}</mesh>
      <mesh geometry={arm} castShadow>{metal}</mesh>
      <group position={[SHADE.x, SHADE.y, SHADE.z]}>
        {/* short stem from the arm into the shade */}
        <mesh position={[0, 0.17 + 0.03, 0]}><cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />{metal}</mesh>
        <DomeShade radius={0.17} height={0.15} />
        <pointLight ref={bulb} position={[0, 0.06, 0]} color="#ffb870" distance={3} decay={2} />
        <spotLight ref={spot} position={[0, 0.04, 0]} color="#ffc98a" angle={0.6} penumbra={0.7} distance={5} decay={2} castShadow target={target} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      </group>
    </group>
  )
}

function Deck() {
  const setFocus = useStore((s) => s.setFocus)
  const vinyl = useRef<THREE.Mesh>(null!)
  const spot = useRef<THREE.SpotLight>(null!)
  const glow = useRef<THREE.PointLight>(null!)
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(-0.12, 0.9, 0); return o }, [])
  const playing = useStore((s) => TRACKS.find((t) => t.id === s.playingId))
  const label = useRef<THREE.MeshStandardMaterial>(null!)
  const speed = useRef(0)
  useFrame((_, dt) => {
    speed.current = damp(speed.current, playing ? 2.4 : 0, 2.5, dt)
    vinyl.current.rotation.y -= dt * speed.current
    label.current.color.lerp(new THREE.Color(playing ? playing.color : '#d8462f'), 1 - Math.exp(-dt * 4))
    spot.current.intensity = 0.7 + 5.5 * env.night
    glow.current.intensity = 0.05 + 0.45 * env.night
  })
  return (
    <group position={[DECK.x, 0, DECK.z]} rotation={[0, Math.PI / 2, 0]}
      onClick={(e) => { e.stopPropagation(); setFocus('deck') }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
      {/* pendant lamp over the deck */}
      <primitive object={target} />
      <Pendant position={[-0.12, 2.1, 0.1]} radius={0.165} height={0.14} />
      <spotLight ref={spot} position={[-0.12, 2.13, 0.1]} color="#ffd6a6" angle={0.55} penumbra={0.7} distance={5} decay={2} target={target} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.0005} />
      <pointLight ref={glow} position={[-0.12, 2.0, 0.1]} color="#ffb870" distance={2.5} decay={2} />
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow><boxGeometry args={[1.3, 0.8, 0.5]} />{wood('#4a3426')}</mesh>
      <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[0.9, 0.1, 0.42]} /><meshStandardMaterial color="#1f1f22" roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[-0.12, 0.905, 0]}><cylinderGeometry args={[0.17, 0.17, 0.01, 48]} /><meshStandardMaterial color="#2c2c30" metalness={0.5} roughness={0.3} /></mesh>
      <mesh ref={vinyl} position={[-0.12, 0.915, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.006, 64]} />
        <meshStandardMaterial color="#0b0b0d" roughness={0.35} metalness={0.2} />
        {/* centre label rides on the disc; a notch makes the spin visible */}
        <mesh position={[0, 0.005, 0]}><cylinderGeometry args={[0.05, 0.05, 0.004, 32]} /><meshStandardMaterial ref={label} color="#d8462f" roughness={0.6} /></mesh>
        <mesh position={[0.035, 0.008, 0]}><boxGeometry args={[0.012, 0.002, 0.004]} /><meshStandardMaterial color="#111" /></mesh>
      </mesh>
      <mesh position={[0.22, 0.95, -0.12]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.3, 0.012, 0.012]} /><meshStandardMaterial color="#c9c9c9" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  )
}

/** Stars exactly as they first were (tiny plain points, gentle twinkle), scattered on a shallow dome under the ceiling. */
function Stars() {
  const mat = useRef<THREE.PointsMaterial>(null!)
  const geo = useMemo(() => {
    const n = 420, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0
      do { x = (Math.random() - 0.5) * 7.4; z = (Math.random() - 0.5) * 7.4 } while (Math.abs(x - SKYLIGHT.x) < SKYLIGHT.w / 2 + 0.12 && Math.abs(z - SKYLIGHT.z) < SKYLIGHT.w / 2 + 0.12)
      pos[i * 3] = x; pos[i * 3 + 1] = 3.14 - (x * x + z * z) * 0.04 - Math.random() * 0.03; pos[i * 3 + 2] = z
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g
  }, [])
  useFrame(({ clock }) => { mat.current.opacity = THREE.MathUtils.smoothstep(env.night, 0.6, 1) * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.3)) })
  return (
    <points geometry={geo}>
      <pointsMaterial ref={mat} color="#fff2c4" size={0.03} transparent opacity={0} sizeAttenuation depthWrite={false} />
    </points>
  )
}

function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 84, 2, 32, 70, 46)
  g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.18, 'rgba(255,236,160,0.95)'); g.addColorStop(0.45, 'rgba(255,150,40,0.55)'); g.addColorStop(0.75, 'rgba(255,90,20,0.12)'); g.addColorStop(1, 'rgba(255,60,0,0)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.moveTo(32, 6); ctx.bezierCurveTo(58, 50, 56, 96, 32, 124); ctx.bezierCurveTo(8, 96, 6, 50, 32, 6); ctx.fill()
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex
}

/** Single-wick jar candle. The flame is an additive sprite that flickers, with a warm light that flickers with it. */
function Candle({ position }: { position: [number, number, number] }) {
  const tex = useMemo(flameTexture, [])
  const flames = useRef<THREE.Sprite[]>([])
  const light = useRef<THREE.PointLight>(null!)
  const wicks: [number, number][] = [[0, 0]]
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    flames.current.forEach((f, i) => {
      if (!f) return
      const n = Math.sin(t * 17 + i * 2.1) * 0.5 + Math.sin(t * 29 + i) * 0.3 + Math.sin(t * 7.3 + i * 4) * 0.2
      f.scale.set(0.036 + n * 0.005, 0.082 + n * 0.014, 1)
      f.position.x = wicks[i][0] + Math.sin(t * 11 + i) * 0.002
    })
    const flick = 0.9 + Math.sin(t * 13) * 0.05 + Math.sin(t * 31) * 0.04 + Math.random() * 0.03
    light.current.intensity = (0.5 + 0.8 * env.night) * flick
  })
  return (
    <group position={position}>
      {/* glass jar with wax inside, lid resting beside it */}
      <mesh position={[0, 0.045, 0]} castShadow><cylinderGeometry args={[0.048, 0.044, 0.09, 32, 1, true]} /><meshPhysicalMaterial color="#f3ece4" transparent opacity={0.28} roughness={0.08} metalness={0} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.032, 0]}><cylinderGeometry args={[0.044, 0.041, 0.064, 32]} /><meshStandardMaterial color="#efe3d3" roughness={0.9} /></mesh>
      <mesh position={[0, 0.045, 0.049]}><planeGeometry args={[0.06, 0.03]} /><meshStandardMaterial color="#d9c2a8" roughness={0.8} /></mesh>
      <mesh position={[0.08, 0.004, -0.02]} rotation={[0, 0.4, 0]} castShadow><cylinderGeometry args={[0.05, 0.05, 0.008, 32]} /><meshStandardMaterial color="#b9b3ab" metalness={0.85} roughness={0.35} /></mesh>
      {wicks.map(([wx, wz], i) => (
        <group key={i} position={[wx, 0.064, wz]}>
          <mesh><cylinderGeometry args={[0.0015, 0.0015, 0.012, 6]} /><meshStandardMaterial color="#1a1410" /></mesh>
          <sprite ref={(s) => { if (s) flames.current[i] = s }} position={[0, 0.04, 0]} scale={[0.036, 0.082, 1]}>
            <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
      <pointLight ref={light} position={[0, 0.11, 0]} color="#ffb060" distance={1.6} decay={2} castShadow shadow-mapSize={[256, 256]} />
    </group>
  )
}
