import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from './store'
import { Bookcase } from './scene/Bookcase'
import { Room } from './scene/Room'
import { Lighting } from './scene/Lighting'
import { CameraRig } from './scene/CameraRig'
import { Overlay } from './ui/Overlay'
import type { Book } from './types'
import { pageFlip, thump } from './audio'

export default function App() {
  const setBooks = useStore((s) => s.setBooks)
  const select = useStore((s) => s.select)
  useEffect(() => {
    fetch('/books.json').then((r) => r.json()).then((d: { books: Book[] }) => setBooks(d.books))
  }, [setBooks])
  const entered = useStore((s) => s.entered)
  const selectedId = useStore((s) => s.selectedId)
  const lastSelected = useRef<string | null>(null)
  useEffect(() => {
    if (!entered) return
    if (selectedId) pageFlip(); else if (lastSelected.current) thump()
    lastSelected.current = selectedId
  }, [entered, selectedId])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') select(null) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [select])

  return (
    <>
      <Canvas shadows camera={{ fov: 50, near: 0.1, far: 30, position: [0.3, 1.75, 6.3] }} dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }} onPointerMissed={() => select(null)}>
        <Lighting />
        <CameraRig />
        <Room />
        <Bookcase />
      </Canvas>
      <Overlay />
    </>
  )
}
