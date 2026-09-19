import type { Book } from '../types'

export const BOOKCASE = {
  x: -1.0, z: -2.82, width: 1.95, depth: 0.34, height: 2.42,
  shelfY: [1.82, 1.2, 0.58], // top surface of each shelf plank, top → bottom
  bookDepth: 0.2, side: 0.045, plank: 0.035,
}
export const SIDE_TABLE = { x: 1.0, z: -2.45, y: 0.62 }
export const CHAIR = { x: 1.4, z: -1.5, ry: -0.72 }
export const DECK = { x: -2.5, z: -0.55 }
export const ROOM = { halfWidth: 2.95 }
/** Where a picked-up shelf book hovers: straight out in front of the bookcase. */
export const SHELF_DISPLAY = { x: BOOKCASE.x, y: 1.35, z: BOOKCASE.z + 1.0 }
/** Where the side-table book hovers when picked up: in front of the chair. */
export const CHAIR_DISPLAY = { x: 1.05, y: 1.15, z: -0.85 }

export interface Slot { x: number; y: number; z: number; w: number; h: number; d: number; row: number }

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

export function bookSize(b: Book) {
  const r = hash(b.id)
  // deliberately chunky: spines have to carry a readable title from across the room
  const h = 0.27 + 0.085 * r
  const w = Math.min(0.088, Math.max(0.032, 0.026 + b.pages * 0.00013))
  return { w, h, d: BOOKCASE.bookDepth - 0.02 * hash(b.id + 'd') }
}

export function layoutBooks(books: Book[]) {
  const slots = new Map<string, Slot>()
  const usable = BOOKCASE.width - BOOKCASE.side * 2 - 0.1
  const left = BOOKCASE.x - BOOKCASE.width / 2 + BOOKCASE.side + 0.05
  const gap = 0.005
  const place = (list: Book[], rows: number[]) => {
    // balance books across the given rows so no row looks sparse
    const total = list.reduce((s, b) => s + bookSize(b).w + gap, 0)
    const perRow = Math.max(usable * 0.55, total / rows.length + 0.02)
    let row = 0, cursor = 0
    for (const b of list) {
      const { w, h, d } = bookSize(b)
      if (cursor + w > Math.min(usable, perRow) && row < rows.length - 1) { row++; cursor = 0 }
      const y = BOOKCASE.shelfY[rows[row]]
      slots.set(b.id, { x: left + cursor + w / 2, y: y + h / 2, z: BOOKCASE.z + 0.02, w, h, d, row: rows[row] })
      cursor += w + gap
    }
  }
  place(books.filter((b) => b.shelf === 'read'), [0, 1])
  place(books.filter((b) => b.shelf === 'to-read'), [2])
  return slots
}
