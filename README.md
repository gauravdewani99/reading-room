# Reading Room

A cosy 3D reading room built from my Goodreads shelves. Books I've read fill the bookcase,
the ones I'm reading now are stacked on the side table, and the to-read pile has its own shelf.
Click a book to lift it off the shelf and read its card; put a record on the turntable; watch
the room drift from afternoon sun to lamplight.

Live: https://my-reading-room.vercel.app

## How it works

- **Data** — `scripts/fetch-goodreads.mjs` reads the public Goodreads shelf RSS feeds (the
  official API is gone), enriches each book with Open Library subjects and cover art, infers a
  genre with a small scoring classifier, and writes `public/books.json` + `public/covers/`.
  Open Library lookups are cached in `scripts/.ol-cache.json`.
- **Scene** — everything is code-built with three.js via React Three Fiber: procedural spine
  labels, plank floor, dome pendants, a sun that arcs through real wall openings, and a starry
  ceiling at night. No glTF assets.
- **Sound** — page flips, thumps and the five lo-fi "city" beats are generated with the Web
  Audio API. Nothing is sampled, so there's nothing to license.

## Run it

```bash
npm install
npm run dev
```

Rebuild the library from a Goodreads profile (shelves must be public):

```bash
GOODREADS_USER_ID=<id> npm run books
```

`npm run books:sample` writes a small fixture set instead.

## Stack

Vite · React 19 · TypeScript · three.js · @react-three/fiber · @react-three/drei · zustand
