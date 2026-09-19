// Tiny procedural sound design (no sample files): page flip, soft thump, panel swoosh.
let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
try { muted = localStorage.getItem('reading-room:muted') === '1' } catch {}

export function isMuted() { return muted }

/** Silences all room audio with a short fade; persisted per visitor. */
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem('reading-room:muted', m ? '1' : '0') } catch {}
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.15)
}

export function getContext() {
  if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination) }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
export function getMaster() { getContext(); return master! }

export function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

/** Paper sliding out of the shelf + a flutter. */
export function pageFlip() {
  const c = getContext(), t = c.currentTime
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.5)
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.18); bp.frequency.exponentialRampToValueAtTime(700, t + 0.42)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.gain.exponentialRampToValueAtTime(0.12, t + 0.2)
  g.gain.linearRampToValueAtTime(0.35, t + 0.27); g.gain.exponentialRampToValueAtTime(0.001, t + 0.48)
  src.connect(bp).connect(g).connect(master!); src.start(t); src.stop(t + 0.5)
}

/** Book settling back onto the shelf. */
export function thump() {
  const c = getContext(), t = c.currentTime
  const o = c.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.12)
  const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  o.connect(g).connect(master!); o.start(t); o.stop(t + 0.2)
}

/** Airy swoosh for the records panel sliding in. */
export function swoosh() {
  const c = getContext(), t = c.currentTime
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 0.6)
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4
  bp.frequency.setValueAtTime(240, t); bp.frequency.exponentialRampToValueAtTime(4200, t + 0.22); bp.frequency.exponentialRampToValueAtTime(900, t + 0.5)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
  src.connect(bp).connect(g).connect(master!); src.start(t); src.stop(t + 0.6)
}
