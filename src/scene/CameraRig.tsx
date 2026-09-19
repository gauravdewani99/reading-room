import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore, env } from '../store'
import { BOOKCASE, SHELF_DISPLAY, CHAIR_DISPLAY, DECK, CHAIR } from './layout'
import type { Focus } from '../types'

const VIEWS: Record<Focus | 'shelfBook' | 'chairBook', { pos: THREE.Vector3; look: THREE.Vector3 }> = {
  // opening shot: the bookcase is the hero, chair and deck sit at the edges for context
  overview: { pos: new THREE.Vector3(-0.3, 1.5, 2.3), look: new THREE.Vector3(-0.72, 1.2, -2.0) },
  shelf: { pos: new THREE.Vector3(BOOKCASE.x + 0.05, 1.42, -0.62), look: new THREE.Vector3(BOOKCASE.x, 1.4, BOOKCASE.z) },
  // book views look straight at the floating book so it sits in the middle of the screen
  shelfBook: { pos: new THREE.Vector3(SHELF_DISPLAY.x, SHELF_DISPLAY.y, SHELF_DISPLAY.z + 1.3), look: new THREE.Vector3(SHELF_DISPLAY.x, SHELF_DISPLAY.y, SHELF_DISPLAY.z) },
  chairBook: { pos: new THREE.Vector3(CHAIR_DISPLAY.x, CHAIR_DISPLAY.y, CHAIR_DISPLAY.z + 1.3), look: new THREE.Vector3(CHAIR_DISPLAY.x, CHAIR_DISPLAY.y, CHAIR_DISPLAY.z) },
  chair: { pos: new THREE.Vector3(0.55, 1.45, 0.95), look: new THREE.Vector3(CHAIR.x, 0.7, CHAIR.z - 0.2) },
  deck: { pos: new THREE.Vector3(DECK.x + 1.35, 1.45, DECK.z + 1.05), look: new THREE.Vector3(DECK.x, 1.0, DECK.z) },
}

export function CameraRig() {
  const focus = useStore((s) => s.focus)
  const selected = useStore((s) => s.selectedId)
  const selectedShelf = useStore((s) => s.books.find((b) => b.id === s.selectedId)?.shelf)
  const entered = useStore((s) => s.entered)
  const { camera } = useThree()
  const look = useMemo(() => VIEWS.overview.look.clone(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => { env.mouse.x = (e.clientX / innerWidth) * 2 - 1; env.mouse.y = -((e.clientY / innerHeight) * 2 - 1) }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame((_, dt) => {
    const view = selected ? (selectedShelf === 'current' ? VIEWS.chairBook : VIEWS.shelfBook) : VIEWS[focus]
    const zoomOut = entered ? 0 : 1.4
    // parallax is nearly frozen while a book is open so the cover stays square to the screen
    const px = selected ? 0.04 : 0.22, py = selected ? 0.02 : 0.1
    tmp.copy(view.pos).add(new THREE.Vector3(env.mouse.x * px, env.mouse.y * py, zoomOut))
    const k = 1.6
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tmp.x, k, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, tmp.y, k, dt)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tmp.z, k, dt)
    look.x = THREE.MathUtils.damp(look.x, view.look.x + env.mouse.x * (selected ? 0 : 0.05), k, dt)
    look.y = THREE.MathUtils.damp(look.y, view.look.y + env.mouse.y * (selected ? 0 : 0.03), k, dt)
    look.z = THREE.MathUtils.damp(look.z, view.look.z, k, dt)
    camera.lookAt(look)
  })
  return null
}
