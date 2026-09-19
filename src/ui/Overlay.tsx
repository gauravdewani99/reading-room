import { useStore } from '../store'
import { TRACKS } from '../beats'
import type { Focus } from '../types'

const NAV: { key: Focus; label: string }[] = [
  { key: 'overview', label: 'Room' }, { key: 'shelf', label: 'Shelf' }, { key: 'chair', label: 'Chair' }, { key: 'deck', label: 'Deck' },
]

export function Overlay() {
  const { entered, enter, mode, toggleMode, muted, toggleMuted, focus, setFocus, books, selectedId, select, deckOpen, closeDeck, playingId, play } = useStore()
  const playing = TRACKS.find((t) => t.id === playingId)
  const book = books.find((b) => b.id === selectedId)

  return (
    <>
      <div className={`enter ${entered ? 'hidden' : ''}`} onClick={enter}>
        <p className="eyebrow">Gaurav's</p>
        <h1>Reading Room</h1>
        <p className="hint">click to enter</p>
      </div>

      <header className={`hud ${entered ? '' : 'hidden'}`}>
        <div className="brand">
          <strong>Reading Room</strong>
        </div>
        <nav>
          {playing && (
            <button className="now" onClick={() => setFocus('deck')} title="Open the deck">
              <span className="disc" style={{ background: playing.color }} />
              {playing.city}
            </button>
          )}
          {NAV.map((n) => (
            <button key={n.key} className={focus === n.key && !selectedId ? 'active' : ''} onClick={() => setFocus(n.key)}>{n.label}</button>
          ))}
          <button className="mode" onClick={toggleMode} title="Toggle day / night">{mode === 'night' ? '☾ night' : '☀ day'}</button>
          <button className={`sound ${muted ? 'off' : ''}`} onClick={toggleMuted} title={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
            {muted ? <MutedIcon /> : <SoundIcon />}
          </button>
        </nav>
      </header>

      <aside className={`deck ${deckOpen && !book ? '' : 'hidden'}`} aria-label="Records">
        <button className="close" onClick={closeDeck} aria-label="Close">×</button>
        <p className="eyebrow">On the deck</p>
        <h2>Pick a record</h2>
        <ul>
          {TRACKS.map((t) => {
            const on = t.id === playingId
            return (
              <li key={t.id}>
                <button className={`record ${on ? 'on' : ''}`} onClick={() => play(t.id)} aria-pressed={on}>
                  <span className="vinyl" style={{ ['--label' as string]: t.color }}><span /></span>
                  <span className="txt">
                    <strong>{t.city}</strong>
                    <small>{t.tag} · {t.bpm} bpm</small>
                  </span>
                  <span className="state">{on ? '❚❚' : '▶'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="foot">Generated live, endlessly. Nothing to license, nothing to loop.</p>
      </aside>

      <aside className={`card ${book ? '' : 'hidden'}`}>
        {book && (
          <>
            <button className="close" onClick={() => select(null)} aria-label="Close">×</button>
            {book.cover && <img src={book.cover} alt="" />}
            <p className="genre">{book.genre}</p>
            <h2>{book.title}</h2>
            <p className="author">{book.author}</p>
            {book.shelf === 'read' && book.rating > 0 && (
              <p className="stars" aria-label={`${book.rating} of 5 stars`}>{'★'.repeat(book.rating)}<span>{'★'.repeat(5 - book.rating)}</span></p>
            )}
            <p className="meta">
              {book.shelf === 'read' && book.readAt && <>Read {fmt(book.readAt)}</>}
              {book.shelf === 'current' && <>Currently reading</>}
              {book.shelf === 'to-read' && <>On the list since {fmt(book.addedAt)}</>}
              {book.pages ? <> · {book.pages} pages</> : null}
            </p>
          </>
        )}
      </aside>
    </>
  )
}

const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const SoundIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
)
const MutedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m22 9-6 6" /><path d="m16 9 6 6" />
  </svg>
)
