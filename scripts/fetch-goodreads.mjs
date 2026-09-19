// Builds public/books.json (+ public/covers/*) from Goodreads shelf RSS feeds.
//   GOODREADS_USER_ID=12345 node scripts/fetch-goodreads.mjs
//   node scripts/fetch-goodreads.mjs --sample     (no Goodreads account needed)
import { XMLParser } from 'fast-xml-parser'
import fs from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('public/books.json')
const COVERS = path.resolve('public/covers')
const LIMITS = { read: 50, current: 3, 'to-read': 10 }
const SYSTEM_SHELVES = new Set(['read', 'currently-reading', 'to-read', 'favorites', 'owned', 'kindle', 'audiobook', 'ebook'])
const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata', trimValues: true, parseTagValue: false })
const txt = (v) => (v && typeof v === 'object' ? (v.__cdata ?? v['#text'] ?? '') : (v ?? '')).toString().trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())

async function fetchShelf(userId, shelf) {
  const items = []
  const seen = new Set()
  for (let page = 1; page <= 5; page++) {
    const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=${shelf}&page=${page}`
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 reading-room' } })
    if (!res.ok) throw new Error(`Goodreads ${shelf} page ${page}: HTTP ${res.status}`)
    const doc = parser.parse(await res.text())
    let list = doc?.rss?.channel?.item ?? []
    if (!Array.isArray(list)) list = [list]
    const fresh = list.filter((it) => !seen.has(txt(it.book_id)))
    if (fresh.length === 0) break
    fresh.forEach((it) => seen.add(txt(it.book_id)))
    items.push(...fresh)
    await sleep(400)
  }
  return items
}

function toBook(it, shelf) {
  const shelves = txt(it.user_shelves).split(',').map((s) => s.trim()).filter(Boolean)
  const custom = shelves.filter((s) => !SYSTEM_SHELVES.has(s))
  const readAt = txt(it.user_read_at)
  const cleanTitle = txt(it.title).replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, '')
  return {
    id: txt(it.book_id),
    title: cleanTitle,
    author: txt(it.author_name),
    isbn: txt(it.isbn) || undefined,
    pages: Number(txt(it.num_pages)) || 280,
    rating: Number(txt(it.user_rating)) || 0,
    avgRating: Number(txt(it.average_rating)) || 0,
    readAt: readAt ? new Date(readAt).toISOString().slice(0, 10) : undefined,
    addedAt: new Date(txt(it.user_date_added) || Date.now()).toISOString().slice(0, 10),
    published: Number(txt(it.book_published)) || undefined,
    shelf,
    custom: custom.length ? titleCase(custom[0].replace(/-/g, ' ')) : undefined,
    description: txt(it.book_description).replace(/<[^>]*>/g, ' ').slice(0, 600),
    coverUrl: txt(it.book_large_image_url) || txt(it.book_image_url),
  }
}

/**
 * Fiction is decided first, because a novel's blurb is full of nonfiction-sounding words
 * ("depression", "politics", "war") and first-match rules kept filing novels under Psychology.
 */
const FICTION_HINT = /\bfiction\b|\bnovel\b|short stories|fiction, literary/i
const NONFICTION_HINT = /non-?fiction|essays|memoir|biograph|history of|true story/i

const FICTION_RULES = [
  ['Science Fiction', /science fiction|sci-?fi|dystopi|space opera|speculative/],
  ['Fantasy', /fantasy|dragons|wizard|magic realism|mytholog/],
  ['Mystery', /mystery|detective|whodunit|crime fiction/],
  ['Thriller', /thriller|suspense|espionage/],
  ['Historical Fiction', /historical fiction|war stories|partition|historical novel/],
  ['Romance', /romance|love stories/],
]

const NONFICTION_RULES = [
  ['Memoir', /memoir|autobiograph|personal narrative|my life in/],
  ['Biography', /biograph|\blife of\b/],
  ['Technology', /artificial intelligence|machine learning|computer|software|internet|algorithm|silicon valley|data science|big data|design, industrial|human-computer/],
  ['Psychology', /psycholog|cognitive|behaviou?ral|mental health|depression|addiction|attention|happiness|intuition|decision making|thought and thinking|self-perception/],
  ['Economics', /econom|capitalism|market|poverty|inequality|nudge|labor|finance/],
  ['Business', /business|startup|entrepreneur|management|leadership|workplace|marketing|fundraising|nonprofit/],
  ['Science', /physics|biology|neuroscience|neurolog|climate|astronom|cosmolog|medicine|medical|evolution|scientific|universe|global warming/],
  ['History', /history|historical|empire|colonial|world war|ancient|civilization|partition/],
  ['Politics', /politic|government|democracy|fascis|caste|activism|social justice|human rights|propaganda|nationalism|dalit/],
  ['Food', /cooking|culinary|food|chef|kitchen|recipe|cookery|spices/],
  ['Sport', /football|soccer|sport|athlet|premier league|climbing|everest|mountaineer/],
  ['Art', /photograph|painting|painter|artist|gallery|drawing|sculpt|creativity/],
  ['Self-help', /self-?help|productivity|habits|personal development|spiritual path|conduct of life|success/],
  ['Language', /english language|vocabulary|etymolog|linguistic|slang|profanit|words\b/],
  ['Reference', /examinations|test prep|study guide|mathematics review|graduate record/],
  ['Design', /design, industrial|industrial design|user experience|usability|human-centered/],
  ['Essays', /essays|reflections|criticism|cultural criticism/],
  ['Society', /sociolog|culture|anthropolog|society|social science|identity|gender|feminis|race relations|journalis/],
]

const countIn = (text, re) => (text.match(new RegExp(re.source, 'gi')) ?? []).length

/**
 * Best-fit rather than first-match: subjects are trusted most, then the title, then the blurb.
 */
function classify(subjects, title, description) {
  const subj = subjects.join(' ').toLowerCase()
  const ti = title.toLowerCase()
  const desc = description.toLowerCase()
  // a couple of signals are strong enough to skip scoring entirely
  if (/\bmemoir\b/.test(ti)) return 'Memoir'
  if (/\bdesign of\b|design thinking/.test(ti)) return 'Design'
  if (/\bgre\b|study guide/.test(ti)) return 'Reference'

  // Open Library often has no subjects at all; fall back to the blurb, where novels say "a novel"
  const fictionText = subj || `${ti} ${desc}`
  const isFiction = FICTION_HINT.test(fictionText) && !NONFICTION_HINT.test(fictionText)
  const rules = isFiction ? FICTION_RULES : NONFICTION_RULES

  let best = null, bestScore = 0
  for (const [genre, re] of rules) {
    const score = 3 * countIn(subj, re) + 2 * countIn(ti, re) + countIn(desc, re)
    if (score > bestScore) { bestScore = score; best = genre }
  }
  if (best) return best
  if (isFiction) return 'Fiction'
  return subjects.length || desc ? 'Nonfiction' : 'Uncategorized'
}

const OL_CACHE = path.resolve('scripts/.ol-cache.json')
let olCache = {}
const loadCache = async () => { try { olCache = JSON.parse(await fs.readFile(OL_CACHE, 'utf8')) } catch { olCache = {} } }
const saveCache = () => fs.writeFile(OL_CACHE, JSON.stringify(olCache, null, 1))

/** One Open Library round trip per book: subjects for the genre, a cover id as a fallback image. */
async function openLibrary(book) {
  if (olCache[book.id]) return olCache[book.id]
  const out = { subjects: [], coverId: null }
  const q = encodeURIComponent(`${book.title} ${book.author}`.slice(0, 160))
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=key,subject,cover_i`)
    if (!res.ok) return out
    const doc = ((await res.json()).docs ?? [])[0]
    if (!doc) return out
    out.coverId = doc.cover_i ?? null
    out.subjects = doc.subject ?? []
    // editions often carry no subjects; the work record usually does
    if (out.subjects.length === 0 && doc.key) {
      await sleep(200)
      const w = await fetch(`https://openlibrary.org${doc.key}.json`)
      if (w.ok) out.subjects = (await w.json()).subjects ?? []
    }
  } catch {}
  olCache[book.id] = out
  return out
}

async function downloadCover(book, coverId) {
  const file = path.join(COVERS, `${book.id}.jpg`)
  try { await fs.access(file); return `/covers/${book.id}.jpg` } catch {}
  const candidates = []
  if (book.coverUrl && !/nophoto/.test(book.coverUrl)) candidates.push(book.coverUrl)
  if (book.isbn) candidates.push(`https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg?default=false`)
  if (coverId) candidates.push(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`)
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 reading-room' } })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 2000) continue
      await fs.writeFile(file, buf)
      return `/covers/${book.id}.jpg`
    } catch {}
  }
  return null
}

async function build(books) {
  await fs.mkdir(COVERS, { recursive: true })
  await loadCache()
  const out = []
  for (const b of books) {
    const cached = !!olCache[b.id]
    const ol = b.custom ? { subjects: [], coverId: null } : await openLibrary(b)
    const cover = await downloadCover(b, ol.coverId)
    const genre = b.custom || classify(ol.subjects, b.title, b.description ?? '')
    const { coverUrl, description, custom, ...rest } = b
    out.push({ ...rest, genre, cover })
    process.stdout.write(`${cover ? '✓' : '✗'} ${genre.padEnd(16)} ${b.shelf.padEnd(8)} ${b.title}\n`)
    if (!cached) await sleep(250)
  }
  await saveCache()
  await fs.writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), books: out }, null, 2))
  console.log(`\nWrote ${out.length} books → ${path.relative(process.cwd(), OUT)}`)
}

async function fromGoodreads(userId) {
  const read = (await fetchShelf(userId, 'read')).map((it) => toBook(it, 'read'))
  const current = (await fetchShelf(userId, 'currently-reading')).map((it) => toBook(it, 'current'))
  const toRead = (await fetchShelf(userId, 'to-read')).map((it) => toBook(it, 'to-read'))
  read.sort((a, b) => (b.readAt ?? '').localeCompare(a.readAt ?? ''))
  toRead.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  return [...read.slice(0, LIMITS.read), ...current.slice(0, LIMITS.current), ...toRead.slice(0, LIMITS['to-read'])]
}

// ---- sample data (used until a Goodreads user id is provided) ----
const S = (shelf, title, author, isbn, pages, genre, rating, readAt) => ({
  id: isbn, title, author, isbn, pages, rating, avgRating: 4.1, readAt, addedAt: readAt ?? '2026-06-01',
  shelf, custom: genre, description: '', coverUrl: null,
})
const SAMPLE = [
  S('read', 'Dune', 'Frank Herbert', '9780441172719', 412, 'Science Fiction', 5, '2026-08-20'),
  S('read', 'Project Hail Mary', 'Andy Weir', '9780593135204', 476, 'Science Fiction', 5, '2026-08-02'),
  S('read', 'Sapiens', 'Yuval Noah Harari', '9780062316097', 443, 'History', 4, '2026-07-15'),
  S('read', 'Klara and the Sun', 'Kazuo Ishiguro', '9780593318171', 303, 'Fiction', 4, '2026-06-28'),
  S('read', 'A Gentleman in Moscow', 'Amor Towles', '9780143110439', 462, 'Fiction', 5, '2026-06-01'),
  S('read', 'Pachinko', 'Min Jin Lee', '9781455563920', 490, 'Fiction', 4, '2026-05-10'),
  S('read', 'The Name of the Wind', 'Patrick Rothfuss', '9780756404741', 662, 'Fantasy', 5, '2026-04-22'),
  S('read', 'Thinking, Fast and Slow', 'Daniel Kahneman', '9780374533557', 499, 'Psychology', 4, '2026-03-30'),
  S('read', 'Norwegian Wood', 'Haruki Murakami', '9780375704024', 296, 'Fiction', 4, '2026-03-08'),
  S('read', 'Steve Jobs', 'Walter Isaacson', '9781451648539', 656, 'Biography', 4, '2026-02-14'),
  S('read', 'The Hobbit', 'J.R.R. Tolkien', '9780547928227', 300, 'Fantasy', 5, '2026-01-20'),
  S('read', 'Meditations', 'Marcus Aurelius', '9780140449334', 304, 'Philosophy', 4, '2025-12-27'),
  S('read', 'Never Let Me Go', 'Kazuo Ishiguro', '9781400078776', 288, 'Fiction', 5, '2025-12-02'),
  S('read', 'Shoe Dog', 'Phil Knight', '9781501135910', 400, 'Memoir', 4, '2025-11-11'),
  S('read', 'The Martian', 'Andy Weir', '9780553418026', 387, 'Science Fiction', 4, '2025-10-19'),
  S('read', 'Educated', 'Tara Westover', '9780399590504', 334, 'Memoir', 5, '2025-09-25'),
  S('read', 'Mistborn: The Final Empire', 'Brandon Sanderson', '9780765350381', 672, 'Fantasy', 4, '2025-09-01'),
  S('read', '1984', 'George Orwell', '9780451524935', 328, 'Fiction', 5, '2025-08-10'),
  S('read', 'Atomic Habits', 'James Clear', '9780735211292', 320, 'Self-help', 3, '2025-07-18'),
  S('read', 'Kafka on the Shore', 'Haruki Murakami', '9781400079278', 467, 'Fiction', 4, '2025-06-22'),
  S('read', 'Zero to One', 'Peter Thiel', '9780804139298', 224, 'Business', 3, '2025-05-30'),
  S('read', 'The Left Hand of Darkness', 'Ursula K. Le Guin', '9780441478125', 304, 'Science Fiction', 5, '2025-05-04'),
  S('read', 'Slaughterhouse-Five', 'Kurt Vonnegut', '9780385333849', 275, 'Fiction', 4, '2025-04-12'),
  S('read', 'The Body Keeps the Score', 'Bessel van der Kolk', '9780143127741', 464, 'Psychology', 4, '2025-03-19'),
  S('read', 'Brave New World', 'Aldous Huxley', '9780060850524', 268, 'Science Fiction', 4, '2025-02-25'),
  S('read', 'Neuromancer', 'William Gibson', '9780441569595', 271, 'Science Fiction', 3, '2025-02-01'),
  S('read', 'The Remains of the Day', 'Kazuo Ishiguro', '9780679731726', 245, 'Fiction', 5, '2025-01-09'),
  S('read', 'The Pragmatic Programmer', 'David Thomas, Andrew Hunt', '9780135957059', 352, 'Technology', 4, '2024-12-15'),
  S('read', 'The Alchemist', 'Paulo Coelho', '9780062315007', 197, 'Fiction', 3, '2024-11-20'),
  S('read', 'The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 180, 'Fiction', 4, '2024-10-30'),
  S('current', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin', '9780593321201', 401, 'Fiction', 0),
  S('current', 'Stoner', 'John Williams', '9781590171998', 278, 'Fiction', 0),
  S('to-read', 'The Three-Body Problem', 'Liu Cixin', '9780765382030', 400, 'Science Fiction', 0),
  S('to-read', 'Piranesi', 'Susanna Clarke', '9781635575637', 245, 'Fantasy', 0),
  S('to-read', 'The Anthropocene Reviewed', 'John Green', '9780525555216', 304, 'Essays', 0),
  S('to-read', 'Circe', 'Madeline Miller', '9780316556347', 393, 'Fantasy', 0),
  S('to-read', 'Why We Sleep', 'Matthew Walker', '9781501144318', 368, 'Science', 0),
]

const userId = process.env.GOODREADS_USER_ID
if (process.argv.includes('--sample') || !userId) {
  if (!userId) console.log('No GOODREADS_USER_ID set → building sample library\n')
  await build(SAMPLE)
} else {
  await build(await fromGoodreads(userId))
}
