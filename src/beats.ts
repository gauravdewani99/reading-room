// Five generative lo-fi study beats, one per city. Everything is synthesised live in Web Audio —
// no audio files, nothing copyrighted. Each track is a preset: tempo, key, scale, chord loop, colour.
import { getContext, getMaster, noiseBuffer } from './audio'

export interface Track { id: string; city: string; color: string; bpm: number; root: number; scale: number[]; chords: number[][]; tag: string }

export const TRACKS: Track[] = [
  { id: 'amsterdam', city: 'Amsterdam', color: '#cfe1f2', bpm: 74, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 4, 7, 11], [7, 11, 14, 17], [9, 12, 16, 19], [5, 9, 12, 16]], tag: 'canal mist' },
  { id: 'london', city: 'London', color: '#e3d6f0', bpm: 70, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]], tag: 'grey drizzle' },
  { id: 'dubai', city: 'Dubai', color: '#f8dcc4', bpm: 80, root: 64, scale: [0, 1, 4, 5, 7, 8, 10], chords: [[0, 4, 7], [1, 5, 8], [0, 4, 7, 10], [8, 12, 15]], tag: 'desert dusk' },
  { id: 'newyork', city: 'New York', color: '#f5d3da', bpm: 86, root: 60, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [0, 4, 7, 11]], tag: 'late-night jazz' },
  { id: 'jaipur', city: 'Jaipur', color: '#f7e8bd', bpm: 66, root: 59, scale: [0, 2, 4, 7, 9], chords: [[0, 7, 12], [0, 4, 7, 12], [0, 7, 12, 16], [0, 4, 7, 11]], tag: 'pink city drone' },
]

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

interface Engine { ctx: AudioContext; bus: GainNode; wet: GainNode; delay: DelayNode; timer: number; nextTime: number; step: number; track: Track; lastMelody: number; crackle: AudioBufferSourceNode }
let engine: Engine | null = null
let impulse: AudioBuffer | null = null

function reverbImpulse(c: AudioContext) {
  if (impulse) return impulse
  const len = Math.floor(c.sampleRate * 2.2), b = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) }
  impulse = b; return b
}

function crackleBuffer(c: AudioContext) {
  const len = Math.floor(c.sampleRate * 4), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.06
  for (let n = 0; n < 90; n++) { const at = Math.floor(Math.random() * (len - 40)); const a = 0.4 + Math.random() * 0.6; for (let k = 0; k < 30; k++) d[at + k] += (Math.random() * 2 - 1) * a * (1 - k / 30) }
  return b
}

export function currentTrack() { return engine?.track ?? null }

export function stopBeat() {
  if (!engine) return
  const e = engine; engine = null
  clearInterval(e.timer)
  e.bus.gain.setTargetAtTime(0, e.ctx.currentTime, 0.35)
  setTimeout(() => { try { e.crackle.stop() } catch {} e.bus.disconnect() }, 1600)
}

export function playBeat(track: Track) {
  stopBeat()
  const ctx = getContext(), master = getMaster()
  const bus = ctx.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(0.85, ctx.currentTime, 0.6)
  const conv = ctx.createConvolver(); conv.buffer = reverbImpulse(ctx)
  const wet = ctx.createGain(); wet.gain.value = 0.28
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200   // lo-fi ceiling
  bus.connect(lp).connect(master); bus.connect(conv).connect(wet).connect(lp)
  const delay = ctx.createDelay(1.5); delay.delayTime.value = (60 / track.bpm) * 0.75
  const fb = ctx.createGain(); fb.gain.value = 0.32
  delay.connect(fb).connect(delay); delay.connect(bus)
  const crackle = ctx.createBufferSource(); crackle.buffer = crackleBuffer(ctx); crackle.loop = true
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
  const cg = ctx.createGain(); cg.gain.value = 0.22
  crackle.connect(hp).connect(cg).connect(bus); crackle.start()
  engine = { ctx, bus, wet, delay, timer: 0, nextTime: ctx.currentTime + 0.15, step: 0, track, lastMelody: 2, crackle }
  engine.timer = window.setInterval(schedule, 80)
  schedule()
}

function schedule() {
  const e = engine; if (!e) return
  const eighth = 60 / e.track.bpm / 2
  while (e.nextTime < e.ctx.currentTime + 0.3) {
    scheduleStep(e, e.step, e.nextTime, eighth)
    e.nextTime += eighth; e.step++
  }
}

function scheduleStep(e: Engine, step: number, t: number, eighth: number) {
  const { ctx, track, bus } = e
  const inBar = step % 8, bar = Math.floor(step / 8)
  const swing = inBar % 2 ? eighth * 0.18 : 0
  if (inBar === 0) pad(ctx, bus, track, track.chords[bar % track.chords.length], t, eighth * 8)
  if (inBar === 0 || inBar === 4) { kick(ctx, bus, t, inBar === 0 ? 0.55 : 0.4); bass(ctx, bus, track, track.chords[bar % track.chords.length][0], t, eighth * 3.5) }
  if (inBar === 3 && Math.random() < 0.35) kick(ctx, bus, t + swing, 0.22)
  if (inBar === 2 || inBar === 6) rim(ctx, bus, t)
  hat(ctx, bus, t + swing, inBar % 2 ? 0.12 : 0.2)
  if (Math.random() < (inBar % 2 ? 0.22 : 0.34)) {
    const s = track.scale
    e.lastMelody = Math.max(0, Math.min(s.length * 2 - 1, e.lastMelody + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.2 ? 2 : 1)))
    const deg = e.lastMelody % s.length, oct = Math.floor(e.lastMelody / s.length)
    pluck(ctx, e, track.root + 12 + s[deg] + oct * 12, t + swing)
  }
}

function pad(ctx: AudioContext, out: AudioNode, track: Track, chord: number[], t: number, dur: number) {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.7); g.gain.setValueAtTime(0.05, t + dur - 0.9); g.gain.linearRampToValueAtTime(0, t + dur + 0.4)
  lp.connect(g).connect(out)
  for (const iv of chord) {
    const f = mtof(track.root - 12 + iv)
    for (const [type, det] of [['triangle', -5], ['sine', 6]] as const) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det
      const vg = ctx.createGain(); vg.gain.value = 0.5
      o.connect(vg).connect(lp); o.start(t); o.stop(t + dur + 0.6)
    }
  }
}

function bass(ctx: AudioContext, out: AudioNode, track: Track, iv: number, t: number, dur: number) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(track.root - 24 + (iv % 12))
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.04); g.gain.setTargetAtTime(0, t + dur * 0.6, 0.18)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.8)
}

function kick(ctx: AudioContext, out: AudioNode, t: number, vel: number) {
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32)
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.35)
}

function hat(ctx: AudioContext, out: AudioNode, t: number, vel: number) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, 0.08)
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
  const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
  s.connect(hp).connect(g).connect(out); s.start(t); s.stop(t + 0.08)
}

function rim(ctx: AudioContext, out: AudioNode, t: number) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, 0.12)
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.2
  const g = ctx.createGain(); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11)
  s.connect(bp).connect(g).connect(out); s.start(t); s.stop(t + 0.12)
}

function pluck(ctx: AudioContext, e: Engine, midi: number, t: number) {
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(midi)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.35)
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
  o.connect(lp).connect(g); g.connect(e.bus); g.connect(e.delay)
  o.start(t); o.stop(t + 0.75)
}
