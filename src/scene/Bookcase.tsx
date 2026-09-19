import { Suspense, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useStore } from '../store'
import { BOOKCASE, layoutBooks } from './layout'
import { Book } from './Book'

const WOOD = '#4a3426'
const WOOD_LIGHT = '#6b4b36'
/** Shelf label type: cream with a soft dark halo so it holds up on the sunlit back board as well as at night. */
export const LABEL = { fontSize: 0.045, color: '#fff3d8', letterSpacing: 0.18, outlineWidth: 0.0028, outlineColor: '#1a1210', outlineOpacity: 0.9 } as const

export function Bookcase() {
  const books = useStore((s) => s.books)
  const setFocus = useStore((s) => s.setFocus)
  const slots = useMemo(() => layoutBooks(books), [books])
  const { x, z, width, depth, height, shelfY, side, plank } = BOOKCASE
  const innerW = width - side * 2

  return (
    <group onClick={(e) => { e.stopPropagation(); setFocus('shelf') }}>
      {/* back board */}
      <mesh position={[x, height / 2, z - depth / 2 + 0.01]} receiveShadow>
        <boxGeometry args={[width, height, 0.02]} />
        <meshStandardMaterial color="#3a2419" roughness={0.9} />
      </mesh>
      {/* sides + top + bottom */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + (s * (width - side)) / 2, height / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[side, height, depth]} />
          <meshStandardMaterial color={WOOD} roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[x, height - plank / 2, z]} castShadow>
        <boxGeometry args={[width, plank, depth]} />
        <meshStandardMaterial color={WOOD} roughness={0.75} />
      </mesh>
      {/* shelves */}
      {[...shelfY, 0.12].map((y, i) => (
        <mesh key={i} position={[x, y - plank / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[innerW, plank, depth]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.75} />
        </mesh>
      ))}
      {/* labels */}
      <Text position={[x - width / 2 + side + 0.05, shelfY[0] + 0.42, z + depth / 2 + 0.002]} anchorX="left" {...LABEL}>ALREADY READ</Text>
      <Text position={[x - width / 2 + side + 0.05, shelfY[2] + 0.42, z + depth / 2 + 0.002]} anchorX="left" {...LABEL}>WANT TO READ</Text>
      {/* bottom cubby: a lazy stack of flat books + a plant */}
      {['#7a4a3a', '#3f5f4a', '#a87a3c'].map((c, i) => (
        <mesh key={c} position={[x - 0.45 + i * 0.015, 0.12 + 0.02 + i * 0.04, z + 0.01]} rotation={[0, (i - 1) * 0.12, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.04, 0.24 - i * 0.02]} />
          <meshStandardMaterial color={c} roughness={0.8} />
        </mesh>
      ))}
      <group position={[x + 0.5, 0.12, z]}>
        <mesh position={[0, 0.07, 0]} castShadow><cylinderGeometry args={[0.07, 0.055, 0.14, 20]} /><meshStandardMaterial color="#b86f4a" roughness={0.9} /></mesh>
        {[[0, 0.24, 0, 0.11], [-0.08, 0.2, 0.03, 0.08], [0.07, 0.21, -0.03, 0.08], [0.02, 0.3, 0.05, 0.07]].map(([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]} castShadow><sphereGeometry args={[r, 12, 10]} /><meshStandardMaterial color="#4c7a45" roughness={1} /></mesh>
        ))}
      </group>
      {books.map((b) => {
        const slot = slots.get(b.id)
        return slot ? <Suspense key={b.id} fallback={null}><Book book={b} slot={slot} /></Suspense> : null
      })}
    </group>
  )
}
