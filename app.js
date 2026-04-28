// app.js — Classical Piano Tutor
// MIDI input + Web Audio synth + falling-notes renderer + game engine.

(() => {
'use strict';

// =======================================================================
// Constants
// =======================================================================

const KEYBOARD_LOW  = 36;  // C2 — Casio CT-X700 lowest
const KEYBOARD_HIGH = 96;  // C7 — Casio CT-X700 highest (61 keys)
const NUM_KEYS      = KEYBOARD_HIGH - KEYBOARD_LOW + 1;

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const IS_BLACK  = pc => [1, 3, 6, 8, 10].includes(pc);

// Left-white index (within octave) for each black-key pitch class
const BLACK_LEFT_WHITE = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Computer-keyboard fallback (two-row piano mapping, C4 start)
const PC_KEY_MAP = {
  // lower row (white keys starting C4)
  KeyZ: 60, KeyX: 62, KeyC: 64, KeyV: 65, KeyB: 67, KeyN: 69, KeyM: 71,
  Comma: 72, Period: 74, Slash: 76,
  // upper row black keys (sharps)
  KeyS: 61, KeyD: 63, KeyG: 66, KeyH: 68, KeyJ: 70,
  KeyL: 73, Semicolon: 75,
  // next octave up (C5)
  KeyQ: 72, KeyW: 74, KeyE: 76, KeyR: 77, KeyT: 79, KeyY: 81, KeyU: 83,
  KeyI: 84, KeyO: 86, KeyP: 88,
  Digit2: 73, Digit3: 75, Digit5: 78, Digit6: 80, Digit7: 82,
  Digit9: 85, Digit0: 87,
};

// Timing window (in beats) for practice mode
const TIMING_WINDOW_BEATS = 0.3;
// How many beats of song time are visible above the hit line
const LOOK_AHEAD_BEATS = 8;
// How many beats past the hit line remain dimly visible
const LOOK_BEHIND_BEATS = 1;

// =======================================================================
// Audio synth (Web Audio)
// =======================================================================

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// A passable piano-ish tone: triangle fundamental + sine octave + quick-attack envelope
function playTone(midi, when, durSec, velocity = 0.6) {
  const ctx = ensureAudio();
  const freq = midiToFreq(midi);
  const g   = ctx.createGain();
  g.connect(ctx.destination);

  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  o1.connect(g);

  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.18;
  o2.connect(g2).connect(g);

  const peak = 0.28 * velocity;
  const attack = 0.005;
  const decay  = Math.min(0.35, Math.max(0.1, durSec * 0.5));
  const sustain = peak * 0.45;
  const release = 0.25;

  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), when + attack + decay);
  g.gain.setValueAtTime(Math.max(sustain, 0.0001), when + Math.max(durSec, attack + decay));
  g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(durSec, attack + decay) + release);

  o1.start(when);
  o2.start(when);
  o1.stop(when + Math.max(durSec, attack + decay) + release + 0.05);
  o2.stop(when + Math.max(durSec, attack + decay) + release + 0.05);
}

function playClick(when, accent = false) {
  const ctx = ensureAudio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.08, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g).connect(ctx.destination);
  o.start(when);
  o.stop(when + 0.06);
}

// =======================================================================
// MIDI input
// =======================================================================

const midi = {
  access: null,
  inputs: [],
  listeners: { on: [], off: [] },
  statusEl: null,

  async init(statusEl) {
    this.statusEl = statusEl;
    if (!navigator.requestMIDIAccess) {
      this.setStatus('error', 'Web MIDI unsupported (use Chrome/Edge)');
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.refreshInputs();
      this.access.onstatechange = () => this.refreshInputs();
    } catch (e) {
      this.setStatus('error', 'MIDI permission denied');
      console.error(e);
    }
  },

  refreshInputs() {
    if (!this.access) return;
    this.inputs = Array.from(this.access.inputs.values());
    for (const inp of this.inputs) inp.onmidimessage = (ev) => this.onMessage(ev);

    if (this.inputs.length === 0) {
      this.setStatus('disconnected', 'MIDI: No device detected — using PC keyboard');
    } else {
      const names = this.inputs.map(i => i.name).join(', ');
      this.setStatus('connected', `MIDI: ${names}`);
    }
  },

  setStatus(cls, text) {
    if (!this.statusEl) return;
    this.statusEl.className = 'midi-status ' + cls;
    this.statusEl.textContent = text;
  },

  onMessage(ev) {
    const [status, data1, data2] = ev.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && data2 > 0) this.fireOn(data1, data2 / 127);
    else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) this.fireOff(data1);
  },

  fireOn(m, vel)  { this.listeners.on.forEach(fn => fn(m, vel)); },
  fireOff(m)      { this.listeners.off.forEach(fn => fn(m)); },
  onNoteOn(fn)    { this.listeners.on.push(fn); },
  onNoteOff(fn)   { this.listeners.off.push(fn); },
};

// =======================================================================
// Piano key layout helpers (shared between renderer and hit testing)
// =======================================================================

function computeLayout(stageWidth) {
  // Count white keys in our MIDI range
  let whiteCount = 0;
  for (let m = KEYBOARD_LOW; m <= KEYBOARD_HIGH; m++) {
    if (!IS_BLACK(m % 12)) whiteCount++;
  }
  const wkw = stageWidth / whiteCount;          // white key width
  const bkw = wkw * 0.6;                        // black key width

  // Precompute x-center for every MIDI note in range.
  const xMap = new Map();
  let whiteIdx = 0;
  for (let m = KEYBOARD_LOW; m <= KEYBOARD_HIGH; m++) {
    const pc = m % 12;
    if (!IS_BLACK(pc)) {
      xMap.set(m, whiteIdx * wkw + wkw / 2);
      whiteIdx++;
    }
  }
  // Black keys: sit at the boundary to the right of their "left white"
  for (let m = KEYBOARD_LOW; m <= KEYBOARD_HIGH; m++) {
    const pc = m % 12;
    if (IS_BLACK(pc)) {
      // Find the white key just below (pc-1 might be a black if rare, but
      // our black-key-left-white table handles it directly).
      const leftWhiteMidi = m - (pc - (pc === 1 ? 0 : pc === 3 ? 2 : pc === 6 ? 5 : pc === 8 ? 7 : 9));
      const lx = xMap.get(leftWhiteMidi);
      if (lx !== undefined) xMap.set(m, lx + wkw / 2); // right edge of left white
    }
  }

  return { wkw, bkw, whiteCount, xMap };
}

// =======================================================================
// Game engine
// =======================================================================

class Engine {
  constructor() {
    this.song = null;
    this.notes = [];
    this.statuses = [];
    this.cursor = 0;           // beats
    this.playing = false;
    this.paused = false;

    this.mode = 'learn';       // 'learn' | 'practice' | 'listen'
    this.hands = 'both';       // 'both' | 'r' | 'l'
    this.transpose = 0;        // semitones
    this.tempoMul = 1;         // user tempo override (0.5–1.5)

    this.heldKeys = new Set();
    this.flashHit = new Map();    // midi -> ms expiry
    this.flashWrong = new Map();
    this.stats = this.freshStats();

    this.nextScheduleIdx = 0;     // for listen-mode audio
    this.nextClickBeat = 0;       // metronome
    this.metronome = false;
  }

  freshStats() {
    return { hits: 0, misses: 0, wrong: 0, streak: 0, best: 0 };
  }

  loadSong(song) {
    this.song = song;
    // Sort notes by start and keep stable order for chords
    this.notes = song.notes.slice().sort((a, b) =>
      a.start - b.start || a.midi - b.midi);
    this.reset();
  }

  reset() {
    this.statuses = this.notes.map(() => 'pending');
    this.cursor = -0.5;        // lead-in
    this.nextScheduleIdx = 0;
    this.nextClickBeat = 0;
    this.stats = this.freshStats();
    this.flashHit.clear();
    this.flashWrong.clear();
    this.playing = false;
  }

  start()   { this.playing = true;  ensureAudio(); }
  stop()    { this.playing = false; }

  filteredOut(note) {
    return this.hands !== 'both' && note.hand !== this.hands;
  }

  bps() {
    return (this.song ? this.song.bpm : 100) * this.tempoMul / 60;
  }

  // Find a pending note that this MIDI noteon should credit.
  tryCredit(midiIn) {
    if (this.mode === 'learn') {
      // Accept any note that matches the next pending checkpoint, even if
      // the user plays it slightly before the cursor arrives.
      const nextStart = this.nextPendingStart();
      if (nextStart === null) return -1;
      for (let i = 0; i < this.notes.length; i++) {
        if (this.statuses[i] !== 'pending') continue;
        const note = this.notes[i];
        if (this.filteredOut(note)) continue;
        if (Math.abs(note.start - nextStart) > 0.01) continue;
        if (note.midi + this.transpose !== midiIn) continue;
        return i;
      }
      return -1;
    }
    // Practice mode: pick nearest pending note within timing window.
    const t = this.cursor;
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < this.notes.length; i++) {
      if (this.statuses[i] !== 'pending') continue;
      const note = this.notes[i];
      if (this.filteredOut(note)) continue;
      if (note.midi + this.transpose !== midiIn) continue;
      const dist = Math.abs(note.start - t);
      if (dist <= TIMING_WINDOW_BEATS && dist < bestDist) {
        bestDist = dist; bestIdx = i;
      }
    }
    return bestIdx;
  }

  noteOn(m, vel = 0.7) {
    this.heldKeys.add(m);
    const ctx = ensureAudio();
    if (!this.playing || this.mode === 'listen') {
      playTone(m, ctx.currentTime, 0.6, vel);
      return;
    }
    const idx = this.tryCredit(m);
    if (idx >= 0) {
      this.statuses[idx] = 'hit';
      this.stats.hits++;
      this.stats.streak++;
      this.stats.best = Math.max(this.stats.best, this.stats.streak);
      this.flashHit.set(m, performance.now() + 260);
      playTone(m, ctx.currentTime, 0.5, vel);
    } else {
      this.stats.wrong++;
      this.stats.streak = 0;
      this.flashWrong.set(m, performance.now() + 400);
      playTone(m, ctx.currentTime, 0.25, vel * 0.7);
    }
  }

  noteOff(m) {
    this.heldKeys.delete(m);
  }

  // Find earliest pending time among notes not filtered out
  nextPendingStart() {
    for (let i = 0; i < this.notes.length; i++) {
      if (this.statuses[i] === 'pending' && !this.filteredOut(this.notes[i])) {
        return this.notes[i].start;
      }
    }
    return null;
  }

  // Is any pending note scheduled?
  anyPending() {
    for (let i = 0; i < this.notes.length; i++) {
      if (this.statuses[i] === 'pending' && !this.filteredOut(this.notes[i])) return true;
    }
    return false;
  }

  update(dtMs) {
    if (!this.playing) return;
    const dt = dtMs / 1000;
    const beatsPerSec = this.bps();

    // metronome scheduling (uses audio clock for accuracy)
    if (this.metronome) {
      const ctx = ensureAudio();
      const lookahead = 0.2;   // seconds
      while (true) {
        const nextBeat = this.nextClickBeat;
        const secsUntil = (nextBeat - this.cursor) / beatsPerSec;
        if (secsUntil > lookahead) break;
        const when = ctx.currentTime + Math.max(0, secsUntil);
        const accent = (nextBeat % 4 === 0);
        playClick(when, accent);
        this.nextClickBeat += 1;
      }
    }

    if (this.mode === 'learn') {
      const next = this.nextPendingStart();
      if (next === null) { this.playing = false; return; }

      // Flow toward next pending checkpoint
      if (this.cursor < next) {
        this.cursor = Math.min(next, this.cursor + dt * beatsPerSec);
      }

      // Auto-satisfy any notes where cursor has reached them AND user already holds them
      if (Math.abs(this.cursor - next) < 0.01) {
        for (let i = 0; i < this.notes.length; i++) {
          if (this.statuses[i] !== 'pending') continue;
          const note = this.notes[i];
          if (this.filteredOut(note)) continue;
          if (Math.abs(note.start - next) > 0.01) continue;
          const needMidi = note.midi + this.transpose;
          if (this.heldKeys.has(needMidi)) {
            this.statuses[i] = 'hit';
            this.stats.hits++;
            this.stats.streak++;
            this.stats.best = Math.max(this.stats.best, this.stats.streak);
            this.flashHit.set(needMidi, performance.now() + 260);
          }
        }
      }

      if (!this.anyPending()) this.playing = false;
    }

    else if (this.mode === 'practice') {
      this.cursor += dt * beatsPerSec;
      // Mark missed notes
      for (let i = 0; i < this.notes.length; i++) {
        if (this.statuses[i] === 'pending' && !this.filteredOut(this.notes[i])) {
          if (this.notes[i].start + TIMING_WINDOW_BEATS < this.cursor) {
            this.statuses[i] = 'missed';
            this.stats.misses++;
            this.stats.streak = 0;
          }
        }
      }
      if (this.cursor > this.song.durationBeats + 2) this.playing = false;
    }

    else if (this.mode === 'listen') {
      const ctx = ensureAudio();
      this.cursor += dt * beatsPerSec;
      // Schedule upcoming notes into the audio graph
      const lookahead = 0.4;
      while (this.nextScheduleIdx < this.notes.length) {
        const note = this.notes[this.nextScheduleIdx];
        if (this.filteredOut(note)) { this.nextScheduleIdx++; continue; }
        const secsUntil = (note.start - this.cursor) / beatsPerSec;
        if (secsUntil > lookahead) break;
        const when = ctx.currentTime + Math.max(0, secsUntil);
        const durSec = note.duration / beatsPerSec;
        playTone(note.midi + this.transpose, when, durSec, 0.5);
        this.nextScheduleIdx++;
      }
      if (this.cursor > this.song.durationBeats + 2) this.playing = false;
    }
  }

  progress() {
    if (!this.song) return 0;
    return Math.max(0, Math.min(1, this.cursor / this.song.durationBeats));
  }

  accuracy() {
    const total = this.stats.hits + this.stats.misses + this.stats.wrong;
    if (total === 0) return 1;
    return this.stats.hits / total;
  }
}

// =======================================================================
// Renderer
// =======================================================================

class Renderer {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.showLabels = false;
    this.showFingers = true;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.W = rect.width;
    this.H = rect.height;
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = computeLayout(this.W);
    this.pianoH = Math.min(160, Math.max(110, this.H * 0.28));
    this.hitLineY = this.H - this.pianoH;
  }

  draw() {
    const { ctx, W, H, layout, hitLineY, pianoH } = this;
    // Warm dark leather gradient stage
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b261c');
    bg.addColorStop(1, '#181410');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.drawGrid();
    this.drawFallingNotes();
    this.drawHitLine();
    this.drawPiano();
  }

  drawGrid() {
    const { ctx, W, hitLineY } = this;
    const e = this.engine;
    if (!e.song) return;
    const pxPerBeat = (hitLineY - 0) / LOOK_AHEAD_BEATS;
    ctx.lineWidth = 1;
    const startBeat = Math.floor(e.cursor);
    for (let b = startBeat; b < e.cursor + LOOK_AHEAD_BEATS + 1; b++) {
      const y = hitLineY - (b - e.cursor) * pxPerBeat;
      if (y < 0 || y > hitLineY) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      // Warm hairlines; downbeats stronger
      ctx.strokeStyle = (b % 4 === 0) ? '#4a3f2a' : '#2a2418';
      ctx.stroke();
    }
  }

  drawHitLine() {
    const { ctx, W, hitLineY } = this;
    // Aged brass line at the hit point
    ctx.strokeStyle = '#c79a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(W, hitLineY);
    ctx.stroke();
    // Warm glow
    ctx.shadowColor = '#c79a3a';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(199, 154, 58, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(W, hitLineY);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawFallingNotes() {
    const e = this.engine;
    if (!e.song) return;
    const { ctx, hitLineY, layout } = this;
    const pxPerBeat = hitLineY / LOOK_AHEAD_BEATS;

    for (let i = 0; i < e.notes.length; i++) {
      const note = e.notes[i];
      if (e.filteredOut(note)) continue;
      const status = e.statuses[i];
      const m = note.midi + e.transpose;
      if (m < KEYBOARD_LOW || m > KEYBOARD_HIGH) continue;

      const topBeat = note.start + note.duration;  // top of block in beats
      const y = hitLineY - (topBeat - e.cursor) * pxPerBeat;
      const h = note.duration * pxPerBeat;

      // cull
      if (y + h < 0) continue;
      if (y > hitLineY + LOOK_BEHIND_BEATS * pxPerBeat) continue;

      const isBlack = IS_BLACK(m % 12);
      const cx = layout.xMap.get(m);
      const w  = (isBlack ? layout.bkw : layout.wkw) * 0.85;
      const x  = cx - w / 2;

      let fill, stroke;
      if (status === 'hit') {
        fill = 'rgba(106, 141, 94, 0.88)'; stroke = '#a8bf9a';       // sage
      } else if (status === 'missed') {
        fill = 'rgba(140, 66, 70, 0.40)'; stroke = '#a85a5e';         // faded burgundy
      } else {
        // pending — forest for RH, claret for LH; fade if past hit line
        const base = note.hand === 'l' ? [170, 85, 90] : [92, 138, 94];
        let alpha = 0.88;
        if (y > hitLineY) alpha = 0.32;
        fill = `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha})`;
        stroke = `rgb(${Math.min(255, base[0]+50)}, ${Math.min(255, base[1]+50)}, ${Math.min(255, base[2]+50)})`;
      }

      // Highlight notes due within timing window (aged-brass pulse)
      if (status === 'pending' && e.mode !== 'listen') {
        const dist = Math.abs(note.start - e.cursor);
        if (dist <= 0.15) {
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 100);
          stroke = `rgba(214, 168, 80, ${0.7 + 0.3 * pulse})`;
          ctx.shadowColor = 'rgba(214, 168, 80, 0.8)';
          ctx.shadowBlur = 14;
        }
      }

      this.roundRect(x, y, w, Math.max(6, h), 4);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fingering number inside the block (if set and block is tall enough)
      if (this.showFingers && note.finger && h >= 14 && w >= 14) {
        const fx = x + w / 2;
        const fy = y + Math.min(h / 2 + 4, h - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.arc(fx, fy - 3, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "EB Garamond", "Garamond", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(note.finger), fx, fy - 3);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawPiano() {
    const { ctx, W, H, layout, hitLineY, pianoH } = this;
    const e = this.engine;
    const pianoY = hitLineY;
    const wkh = pianoH;
    const bkh = pianoH * 0.62;

    const now = performance.now();

    // Expected notes at cursor (midi -> {hand, finger}) for target highlighting
    const expectedAtCursor = new Map();
    if (e.song) {
      for (let i = 0; i < e.notes.length; i++) {
        if (e.statuses[i] !== 'pending') continue;
        const n = e.notes[i];
        if (e.filteredOut(n)) continue;
        const dist = Math.abs(n.start - e.cursor);
        const threshold = e.mode === 'learn' ? 0.02 : TIMING_WINDOW_BEATS;
        if (dist <= threshold) {
          expectedAtCursor.set(n.midi + e.transpose, { hand: n.hand, finger: n.finger });
        }
      }
    }

    // In Listen (demo) mode: auto-light piano keys for notes currently sounding.
    // A short "min flash" makes very brief notes still visible.
    const soundingRH = new Set();
    const soundingLH = new Set();
    if (e.mode === 'listen' && e.song && e.playing) {
      const minFlashBeats = Math.max(0.12 * e.bps(), 0.08); // ~120ms minimum
      for (let i = 0; i < e.notes.length; i++) {
        const note = e.notes[i];
        if (e.filteredOut(note)) continue;
        const endVisible = note.start + Math.max(note.duration, minFlashBeats);
        if (note.start <= e.cursor && e.cursor < endVisible) {
          const mm = note.midi + e.transpose;
          if (note.hand === 'l') soundingLH.add(mm); else soundingRH.add(mm);
        }
      }
    }

    // white keys
    let whiteIdx = 0;
    for (let m = KEYBOARD_LOW; m <= KEYBOARD_HIGH; m++) {
      if (IS_BLACK(m % 12)) continue;
      const x = whiteIdx * layout.wkw;
      let fill = '#d8c49b';                                // aged ivory
      const pressed = e.heldKeys.has(m);
      if (pressed) fill = '#b89d66';                        // pressed ochre
      if (this.flashHit(m, now)) fill = '#89ab7e';           // mid sage
      if (this.flashWrong(m, now)) fill = '#ac7878';         // mid rose-claret
      if (expectedAtCursor.has(m) && !pressed) fill = '#c49536'; // deep brass
      if (soundingRH.has(m)) fill = '#8fae8c';               // mid forest
      if (soundingLH.has(m)) fill = '#a57d81';               // mid claret

      ctx.fillStyle = fill;
      ctx.fillRect(x + 0.5, pianoY, layout.wkw - 1, wkh);
      ctx.strokeStyle = '#120e08';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, pianoY + 0.5, layout.wkw - 1, wkh - 1);

      // "C" labels or all labels (serif, inked brown)
      if (this.showLabels || (m % 12 === 0)) {
        ctx.fillStyle = '#3a2f20';
        ctx.font = (this.showLabels ? 'italic 10px' : 'italic 600 11px') + ' "EB Garamond", serif';
        ctx.textAlign = 'center';
        const name = NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
        ctx.fillText(name, x + layout.wkw / 2, pianoY + wkh - 6);
      }

      // Fingering on expected key (top of key)
      const exp = expectedAtCursor.get(m);
      if (this.showFingers && exp && exp.finger) {
        const cx = x + layout.wkw / 2;
        const cy = pianoY + 14;
        ctx.fillStyle = exp.hand === 'l' ? '#7a2a3a' : '#2e5a3a';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "EB Garamond", "Garamond", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(exp.finger), cx, cy);
        ctx.textBaseline = 'alphabetic';
      }

      whiteIdx++;
    }

    // black keys
    for (let m = KEYBOARD_LOW; m <= KEYBOARD_HIGH; m++) {
      if (!IS_BLACK(m % 12)) continue;
      const cx = layout.xMap.get(m);
      const x = cx - layout.bkw / 2;
      let fill = '#1a150e';                                // ebony
      const pressed = e.heldKeys.has(m);
      if (pressed) fill = '#3e3320';                        // lit ebony
      if (this.flashHit(m, now)) fill = '#4c6a48';          // dark sage
      if (this.flashWrong(m, now)) fill = '#6a2f33';        // dark claret
      if (expectedAtCursor.has(m) && !pressed) fill = '#a6791d'; // aged brass
      if (soundingRH.has(m)) fill = '#3d5a3c';              // dark forest
      if (soundingLH.has(m)) fill = '#5a2f37';              // dark claret

      ctx.fillStyle = fill;
      ctx.fillRect(x, pianoY, layout.bkw, bkh);
      ctx.strokeStyle = '#0a0804';
      ctx.strokeRect(x + 0.5, pianoY + 0.5, layout.bkw - 1, bkh - 1);

      if (this.showLabels) {
        ctx.fillStyle = '#ebe0c4';
        ctx.font = 'italic 9px "EB Garamond", serif';
        ctx.textAlign = 'center';
        const name = NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
        ctx.fillText(name, x + layout.bkw / 2, pianoY + bkh - 5);
      }

      // Fingering on expected black key
      const exp = expectedAtCursor.get(m);
      if (this.showFingers && exp && exp.finger) {
        const cx = x + layout.bkw / 2;
        const cy = pianoY + 12;
        ctx.fillStyle = exp.hand === 'l' ? '#7a2a3a' : '#2e5a3a';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "EB Garamond", "Garamond", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(exp.finger), cx, cy);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  flashHit(m, now) {
    const t = this.engine.flashHit.get(m);
    if (!t) return false;
    if (t < now) { this.engine.flashHit.delete(m); return false; }
    return true;
  }
  flashWrong(m, now) {
    const t = this.engine.flashWrong.get(m);
    if (!t) return false;
    if (t < now) { this.engine.flashWrong.delete(m); return false; }
    return true;
  }
}

// =======================================================================
// UI glue
// =======================================================================

const ui = {};

function initUI() {
  ui.songSel    = document.getElementById('song');
  ui.modeSel    = document.getElementById('mode');
  ui.handsSel   = document.getElementById('hands');
  ui.tempo      = document.getElementById('tempo');
  ui.tempoVal   = document.getElementById('tempo-val');
  ui.transpose  = document.getElementById('transpose');
  ui.labels     = document.getElementById('labels');
  ui.fingers    = document.getElementById('fingers');
  ui.metronome  = document.getElementById('metronome');
  ui.btnStart   = document.getElementById('start');
  ui.btnStop    = document.getElementById('stop');
  ui.btnRestart = document.getElementById('restart');
  ui.midiStatus = document.getElementById('midi-status');

  ui.accuracy = document.getElementById('accuracy');
  ui.hits     = document.getElementById('hits');
  ui.misses   = document.getElementById('misses');
  ui.streak   = document.getElementById('streak');
  ui.progress = document.getElementById('progress');

  ui.banner = null;

  // Populate song list
  const order = [
    'cMajorScale', 'cMajorArpeggio', 'hanon1',
    'twinkle', 'mary', 'happyBirthday',
    'odeToJoy', 'furEliseOpening', 'minuetInG',
    'preludeInC', 'gymnopedie', 'canonInD',
    'moonlightOpening',
  ];
  for (const id of order) {
    if (!SONGS[id]) continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = SONGS[id].title + ' — ' + SONGS[id].composer;
    ui.songSel.appendChild(opt);
  }
}

function showBanner(text, cls = '', ms = 1800) {
  if (ui.banner) ui.banner.remove();
  const b = document.createElement('div');
  b.className = 'banner ' + cls;
  b.textContent = text;
  document.querySelector('.stage').appendChild(b);
  ui.banner = b;
  setTimeout(() => { if (b === ui.banner) { b.remove(); ui.banner = null; } }, ms);
}

// =======================================================================
// Main
// =======================================================================

const engine = new Engine();
let renderer = null;

function currentSong() {
  return SONGS[ui.songSel.value];
}

function reloadSong() {
  const song = currentSong();
  if (!song) return;
  engine.loadSong(song);
  // Sync tempo slider to this song's default BPM
  ui.tempo.value = song.bpm;
  ui.tempoVal.textContent = song.bpm;
}

function applyControls() {
  engine.mode       = ui.modeSel.value;
  engine.hands      = ui.handsSel.value;
  engine.tempoMul   = parseInt(ui.tempo.value, 10) / (currentSong()?.bpm || 100);
  engine.transpose  = parseInt(ui.transpose.value, 10) || 0;
  engine.metronome  = ui.metronome.checked;
  if (renderer) {
    renderer.showLabels  = ui.labels.checked;
    renderer.showFingers = ui.fingers.checked;
  }
}

function wireEvents() {
  ui.songSel.addEventListener('change', () => { reloadSong(); applyControls(); });
  ui.modeSel.addEventListener('change', () => applyControls());
  ui.handsSel.addEventListener('change', () => applyControls());
  ui.transpose.addEventListener('change', () => applyControls());
  ui.labels.addEventListener('change', () => applyControls());
  ui.fingers.addEventListener('change', () => applyControls());
  ui.metronome.addEventListener('change', () => applyControls());

  ui.tempo.addEventListener('input', () => {
    ui.tempoVal.textContent = ui.tempo.value;
    applyControls();
  });

  ui.btnStart.addEventListener('click', () => {
    ensureAudio();
    if (!engine.song) reloadSong();
    applyControls();
    engine.reset();
    engine.start();
    showBanner('Playing: ' + engine.song.title);
  });
  ui.btnStop.addEventListener('click', () => {
    engine.stop();
    showBanner('Stopped');
  });
  ui.btnRestart.addEventListener('click', () => {
    engine.reset();
    engine.start();
    showBanner('Restarted');
  });

  // MIDI note callbacks
  midi.onNoteOn((m, vel) => engine.noteOn(m, vel));
  midi.onNoteOff((m) => engine.noteOff(m));

  // Computer keyboard fallback
  const pcHeld = new Set();
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    const m = PC_KEY_MAP[ev.code];
    if (m === undefined) return;
    if (pcHeld.has(m)) return;
    pcHeld.add(m);
    engine.noteOn(m, 0.7);
    ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => {
    const m = PC_KEY_MAP[ev.code];
    if (m === undefined) return;
    pcHeld.delete(m);
    engine.noteOff(m);
  });
}

function renderHUD() {
  ui.accuracy.textContent = Math.round(engine.accuracy() * 100) + '%';
  ui.hits.textContent     = engine.stats.hits;
  ui.misses.textContent   = engine.stats.misses + engine.stats.wrong;
  ui.streak.textContent   = engine.stats.streak;
  ui.progress.textContent = Math.round(engine.progress() * 100) + '%';

  const acc = engine.accuracy();
  ui.accuracy.parentElement.classList.toggle('good', acc >= 0.9);
  ui.accuracy.parentElement.classList.toggle('warn', acc >= 0.7 && acc < 0.9);
  ui.accuracy.parentElement.classList.toggle('bad',  acc < 0.7 && (engine.stats.hits + engine.stats.misses + engine.stats.wrong) > 4);
}

let lastFrame = performance.now();
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  engine.update(dt);
  if (renderer) renderer.draw();
  renderHUD();
  requestAnimationFrame(loop);
}

async function main() {
  initUI();
  wireEvents();
  await midi.init(ui.midiStatus);

  const canvas = document.getElementById('stage');
  renderer = new Renderer(canvas, engine);

  reloadSong();
  applyControls();

  // First user gesture will unlock audio; show a hint until then.
  const unlockAudio = () => { ensureAudio(); document.removeEventListener('pointerdown', unlockAudio); };
  document.addEventListener('pointerdown', unlockAudio);

  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', main);

})();
