import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import type { Book as BookT } from '../types'
import { useStore } from '../store'
import { SHELF_DISPLAY as DISPLAY, type Slot } from './layout'

const damp = THREE.MathUtils.damp

/** Placeholder cover for books with no artwork — a data URI so it can never 404. */
export const MISSING_COVER = (() => {
  const c = document.createElement('canvas'); c.width = 400; c.height = 600
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#5a4a3f'; ctx.fillRect(0, 0, 400, 600)
  ctx.strokeStyle = '#d9c6a5'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, 352, 552)
  ctx.fillStyle = '#d9c6a5'; ctx.textAlign = 'center'; ctx.font = '28px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText('No cover', 200, 310)
  return c.toDataURL('image/png')
})()

function averageColor(img: HTMLImageElement) {
  const c = document.createElement('canvas'); c.width = c.height = 8
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, 8, 8)
  const d = ctx.getImageData(0, 0, 8, 8).data
  let r = 0, g = 0, b = 0
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
  const n = d.length / 4
  const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255)
  const hsl = { h: 0, s: 0, l: 0 }; col.getHSL(hsl)
  col.setHSL(hsl.h, Math.min(0.78, Math.max(0.36, hsl.s * 1.3 + 0.1)), Math.min(0.38, Math.max(0.2, hsl.l * 0.8)))
  return col
}

/** The spine label: title (and author, where the spine is wide enough) printed on the spine colour. */
function spineTexture(title: string, author: string, color: THREE.Color, w: number, h: number) {
  const H = 1024, W = Math.max(90, Math.round((w / h) * H))
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = `#${color.getHexString()}`; ctx.fillRect(0, 0, W, H)
  const hsl = { h: 0, s: 0, l: 0 }; color.getHSL(hsl)
  ctx.fillStyle = hsl.l > 0.45 ? '#1a1410' : '#f6efe2'
  ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3
  ctx.strokeRect(10, 16, W - 20, H - 32)
  ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const size = Math.min(W * 0.6, 70)
  ctx.font = `600 ${size}px "Helvetica Neue", Arial, sans-serif`
  let t = title
  while (ctx.measureText(t).width > H - 144 && t.length > 4) t = t.slice(0, -2)
  if (t !== title) t = t.trimEnd() + '…'
  ctx.fillText(t, 0, W > 145 ? -size * 0.35 : 0)
  if (W > 145) {
    ctx.font = `400 ${size * 0.55}px "Helvetica Neue", Arial, sans-serif`
    ctx.fillText(author.toUpperCase(), 0, size * 0.6)
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16
  return tex
}

/** Cut page edges: fine striations with a little colour drift, used as colour + roughness. */
const pageMaps = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, 512, 512)
  for (let x = 0; x < 512; x++) {
    const v = 0.5 + Math.sin(x * 2.3) * 0.18 + Math.random() * 0.5
    ctx.fillStyle = `rgba(${v > 0.8 ? 255 : 120}, ${v > 0.8 ? 250 : 105}, ${v > 0.8 ? 235 : 88}, ${Math.min(0.32, Math.abs(v - 0.6) * 0.5)})`
    ctx.fillRect(x, 0, 1, 512)
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8

  // roughness: the same striations, so light catches the page block unevenly
  const r = document.createElement('canvas'); r.width = 512; r.height = 512
  const rx = r.getContext('2d')!
  rx.fillStyle = '#d8d8d8'; rx.fillRect(0, 0, 512, 512)
  for (let x = 0; x < 512; x++) {
    const v = 190 + Math.round(Math.random() * 55 + Math.sin(x * 1.7) * 18)
    rx.fillStyle = `rgb(${v},${v},${v})`; rx.fillRect(x, 0, 1, 512)
  }
  const rough = new THREE.CanvasTexture(r); rough.anisotropy = 8
  return { map, rough }
})()

const PAGES = new THREE.MeshPhysicalMaterial({ map: pageMaps.map, roughnessMap: pageMaps.rough, roughness: 1, sheen: 0.12, sheenRoughness: 0.9, sheenColor: new THREE.Color('#fff6e2') })

/** Paper / cloth grain, plus (for the spine) the gentle barrel curve of a bound edge. */
function grainNormal(curved: boolean) {
  const S = 256
  const c = document.createElement('canvas'); c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      // cylinder across the spine width, flat for covers
      const u = x / (S - 1) * 2 - 1
      const nx = curved ? u * 0.85 : 0
      const grain = (Math.random() - 0.5) * 0.16
      const ny = grain
      const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
const COVER_N = grainNormal(false)
const SPINE_N = grainNormal(true)

export function Book({ book, slot }: { book: BookT; slot: Slot }) {
  const group = useRef<THREE.Group>(null!)
  const cover = useLoader(THREE.TextureLoader, book.cover ?? MISSING_COVER)
  const [color, setColor] = useState(() => new THREE.Color().setHSL(hash01(book.id), 0.45, 0.35))
  const hovered = useStore((s) => s.hoveredId === book.id)
  const selected = useStore((s) => s.selectedId === book.id)
  const { hover, select } = useStore.getState()

  useEffect(() => {
    cover.colorSpace = THREE.SRGBColorSpace; cover.anisotropy = 8
    if (cover.image) setColor(averageColor(cover.image as HTMLImageElement))
  }, [cover])

  const spine = useMemo(() => spineTexture(book.title, book.author, color, slot.w, slot.h), [book, color, slot.w, slot.h])
  const materials = useMemo(() => {
    // printed dust jacket: matte laminate with a faint paper grain; a light clearcoat gives it a
    // soft specular without hazing the artwork
    const jacket = new THREE.MeshPhysicalMaterial({
      map: cover, normalMap: COVER_N, normalScale: new THREE.Vector2(0.12, 0.12),
      roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.5,
    })
    // bound spine: cloth-like, curved so the light rolls across it. Sheen kept low so the colour
    // reads as ink rather than a pastel wash under the pendant.
    const spineMat = new THREE.MeshPhysicalMaterial({
      map: spine, normalMap: SPINE_N, normalScale: new THREE.Vector2(0.4, 0.15),
      roughness: 0.82, sheen: 0.12, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffe9cf'),
    })
    const board = new THREE.MeshPhysicalMaterial({
      color, normalMap: COVER_N, normalScale: new THREE.Vector2(0.15, 0.15), roughness: 0.78,
    })
    return [jacket, board, PAGES, PAGES, spineMat, board]
  }, [cover, spine, color])

  useFrame((_, dt) => {
    const g = group.current
    g.rotation.order = 'YXZ'
    const tx = selected ? DISPLAY.x : slot.x
    const ty = selected ? DISPLAY.y : slot.y
    const tz = selected ? DISPLAY.z : slot.z + (hovered ? 0.075 : 0)
    // picked up: cover square to the camera
    const ry = selected ? -Math.PI / 2 : 0
    const rx = selected ? 0 : hovered ? -0.06 : 0
    const sc = selected ? 1.5 : 1
    const k = selected ? 5 : 9
    g.position.set(damp(g.position.x, tx, k, dt), damp(g.position.y, ty, k, dt), damp(g.position.z, tz, k, dt))
    g.rotation.set(damp(g.rotation.x, rx, k, dt), damp(g.rotation.y, ry, k, dt), damp(g.rotation.z, 0, k, dt))
    const s = damp(g.scale.x, sc, k, dt); g.scale.setScalar(s)
  })

  return (
    <group ref={group} position={[slot.x, slot.y, slot.z]}>
      <mesh
        material={materials}
        castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); hover(book.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { hover(null); document.body.style.cursor = 'auto' }}
        onClick={(e) => { e.stopPropagation(); select(selected ? null : book.id) }}
      >
        <boxGeometry args={[slot.w, slot.h, slot.d]} />
      </mesh>
    </group>
  )
}

function hash01(s: string) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1000; return h / 1000 }
