export type Shelf = 'read' | 'current' | 'to-read'

export interface Book {
  id: string
  title: string
  author: string
  isbn?: string
  pages: number
  rating: number
  avgRating: number
  readAt?: string
  addedAt: string
  published?: number
  shelf: Shelf
  genre: string
  cover: string | null
}

export type Focus = 'overview' | 'shelf' | 'chair' | 'deck'
export type Mode = 'day' | 'night'
