import { create } from 'zustand'
import * as THREE from 'three'
import type { Book, Focus, Mode } from './types'
import { isMuted, setMuted, swoosh } from './audio'
import { TRACKS, playBeat, stopBeat } from './beats'

interface State {
  books: Book[]
  setBooks: (b: Book[]) => void
  entered: boolean
  enter: () => void
  mode: Mode
  toggleMode: () => void
  muted: boolean
  toggleMuted: () => void
  focus: Focus
  setFocus: (f: Focus) => void
  hoveredId: string | null
  hover: (id: string | null) => void
  selectedId: string | null
  select: (id: string | null) => void
  deckOpen: boolean
  closeDeck: () => void
  playingId: string | null
  play: (id: string) => void
}

export const useStore = create<State>((set) => ({
  books: [],
  setBooks: (books) => set({ books }),
  entered: false,
  enter: () => set({ entered: true }),
  mode: 'night',
  toggleMode: () => set((s) => ({ mode: s.mode === 'day' ? 'night' : 'day' })),
  muted: isMuted(),
  toggleMuted: () => set((s) => { setMuted(!s.muted); return { muted: !s.muted } }),
  focus: 'overview',
  setFocus: (focus) => set((s) => {
    const opening = focus === 'deck' && !s.deckOpen
    if (opening) swoosh()
    return { focus, selectedId: null, deckOpen: focus === 'deck' }
  }),
  deckOpen: false,
  closeDeck: () => set({ deckOpen: false }),
  playingId: null,
  play: (id) => set((s) => {
    if (s.playingId === id) { stopBeat(); return { playingId: null } }
    const track = TRACKS.find((t) => t.id === id)
    if (track) playBeat(track)
    return { playingId: id }
  }),
  hoveredId: null,
  hover: (hoveredId) => set({ hoveredId }),
  selectedId: null,
  // a picked-up book presents where it lives: shelf books at the shelf, the side-table book at the chair
  select: (selectedId) => set((s) => {
    if (!selectedId) return { selectedId }
    if (s.deckOpen) return { selectedId, deckOpen: false, focus: s.books.find((b) => b.id === selectedId)?.shelf === 'current' ? 'chair' : 'shelf' }
    const book = s.books.find((b) => b.id === selectedId)
    return { selectedId, focus: book?.shelf === 'current' ? 'chair' : 'shelf' }
  }),
}))

/** Mutable, non-reactive per-frame environment state (0 = day, 1 = night). */
export const env = { night: 1, mouse: { x: 0, y: 0 }, sunPos: new THREE.Vector3(-8, 8, 3), sunEl: 0.8 }
