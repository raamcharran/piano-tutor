// songs.js — classical piano tutor song library (with fingerings)
// Notes use beat-units where 1 beat = quarter note.
// Fingering: 1 = thumb, 5 = pinky. Append '/N' to any pitch string, e.g.
// 'C4/1', 'F#5/4'. Chords: ['C4/1','E4/3','G4/5'].

// --- helpers ------------------------------------------------------------

const NOTE_TO_SEMITONE = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

// Pitch string to MIDI (Middle C = C4 = 60).
function n(pitch) {
  const m = pitch.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!m) throw new Error('Bad pitch: ' + pitch);
  return NOTE_TO_SEMITONE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}

// Parse 'C4/3' -> {pitch: 'C4', finger: 3}. 'C4' -> {pitch: 'C4', finger: null}.
function parsePF(s) {
  const i = s.indexOf('/');
  if (i < 0) return { pitch: s, finger: null };
  return { pitch: s.slice(0, i), finger: parseInt(s.slice(i + 1), 10) };
}

// Compact sequence builder. Accepts pitch strings with optional '/F' fingering.
function seq(hand, startBeat, items) {
  const out = [];
  let t = startBeat;
  for (let i = 0; i < items.length; i += 2) {
    const p = items[i];
    const d = items[i + 1];
    if (p === 'rest' || p === 'r' || p === '-') {
      t += d;
      continue;
    }
    const pitches = Array.isArray(p) ? p : [p];
    for (const pp of pitches) {
      const { pitch, finger } = parsePF(pp);
      out.push({ midi: n(pitch), start: t, duration: d, hand, finger });
    }
    t += d;
  }
  return out;
}

// Build a scale with per-note fingerings if provided.
function buildScale(rootMidi, intervals, octaves, noteDur, hand, fingersUp, fingersDn) {
  const up = [0];
  for (let o = 0; o < octaves; o++) {
    for (const step of intervals) up.push(up[up.length - 1] + step);
  }
  const full = up.concat([...up].reverse().slice(1));
  const fingers = (fingersUp && fingersDn)
    ? fingersUp.concat(fingersDn.slice(1))
    : full.map(() => null);
  return full.map((semis, i) => ({
    midi: rootMidi + semis,
    start: i * noteDur,
    duration: noteDur,
    hand,
    finger: fingers[i] || null,
  }));
}

// --- song library -------------------------------------------------------

const SONGS = {

  // --- warm-ups ---------------------------------------------------------
  cMajorScale: {
    title: 'C Major Scale (2 octaves)',
    composer: 'Warm-up',
    bpm: 96,
    // Standard RH 2-octave fingering: up 1-2-3-1-2-3-4-1-2-3-1-2-3-4-5,
    // down 5-4-3-2-1-3-2-1-4-3-2-1-3-2-1.
    notes: buildScale(n('C4'), [2, 2, 1, 2, 2, 2, 1], 2, 0.5, 'r',
      [1,2,3,1,2,3,4,1,2,3,1,2,3,4,5],
      [5,4,3,2,1,3,2,1,4,3,2,1,3,2,1]),
  },

  cMajorArpeggio: {
    title: 'C Major Arpeggio (2 octaves)',
    composer: 'Warm-up',
    bpm: 96,
    // Standard RH: up 1-2-3-1-2-3-5, down 3-2-1-3-2-1.
    notes: (() => {
      const midis = [n('C4'), n('E4'), n('G4'), n('C5'), n('E5'), n('G5'), n('C6')];
      const order = midis.concat([...midis].reverse().slice(1));
      const fingers = [1,2,3,1,2,3,5,  3,2,1,3,2,1];
      return order.map((m, i) => ({
        midi: m, start: i * 0.5, duration: 0.5, hand: 'r', finger: fingers[i],
      }));
    })(),
  },

  hanon1: {
    title: 'Hanon Exercise No. 1 (2 bars)',
    composer: 'Warm-up',
    bpm: 90,
    // RH pattern fingering: 1-3-4-5-4-3-2-1, transposed up by step each group.
    notes: (() => {
      const pattern = ['C4','E4','F4','G4','A4','G4','F4','E4'];
      const fingers = [1,3,4,5,4,3,2,1];
      const notes = [];
      let t = 0;
      for (let shift = 0; shift < 8; shift++) {
        pattern.forEach((p, idx) => {
          notes.push({
            midi: n(p) + shift, start: t, duration: 0.25,
            hand: 'r', finger: fingers[idx],
          });
          t += 0.25;
        });
      }
      return notes;
    })(),
  },

  // --- easy -------------------------------------------------------------
  twinkle: {
    title: 'Twinkle Twinkle Little Star',
    composer: 'Traditional',
    bpm: 100,
    notes: [
      // RH: hand in C-G position (1 on C, 5 on G), 5 stretches up to A.
      ...seq('r', 0, [
        'C4/1',1, 'C4/1',1, 'G4/5',1, 'G4/5',1, 'A4/5',1, 'A4/5',1, 'G4/5',2,
        'F4/4',1, 'F4/4',1, 'E4/3',1, 'E4/3',1, 'D4/2',1, 'D4/2',1, 'C4/1',2,
        'G4/5',1, 'G4/5',1, 'F4/4',1, 'F4/4',1, 'E4/3',1, 'E4/3',1, 'D4/2',2,
        'G4/5',1, 'G4/5',1, 'F4/4',1, 'F4/4',1, 'E4/3',1, 'E4/3',1, 'D4/2',2,
        'C4/1',1, 'C4/1',1, 'G4/5',1, 'G4/5',1, 'A4/5',1, 'A4/5',1, 'G4/5',2,
        'F4/4',1, 'F4/4',1, 'E4/3',1, 'E4/3',1, 'D4/2',1, 'D4/2',1, 'C4/1',2,
      ]),
      // LH chords — fingerings left unset (varies with hand size / voicing).
      ...seq('l', 0, [
        ['C3','E3'],2, ['C3','G3'],2,
        ['F3','A3'],2, ['C3','E3'],2,
        ['F3','A3'],2, ['C3','G3'],2,
        ['C3','E3'],2, ['G3','B3'],2,
        ['C3','E3'],2, ['G3','B3'],2,
        ['C3','E3'],2, ['G3','B3'],2,
        ['C3','E3'],2, ['G3','B3'],2,
        ['C3','E3'],2, ['C3','G3'],2,
        ['F3','A3'],2, ['C3','E3'],2,
        ['F3','A3'],2, ['C3','E3'],2,
      ]),
    ],
  },

  mary: {
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional',
    bpm: 100,
    // RH in five-finger C position.
    notes: seq('r', 0, [
      'E4/3',1, 'D4/2',1, 'C4/1',1, 'D4/2',1, 'E4/3',1, 'E4/3',1, 'E4/3',2,
      'D4/2',1, 'D4/2',1, 'D4/2',2, 'E4/3',1, 'G4/5',1, 'G4/5',2,
      'E4/3',1, 'D4/2',1, 'C4/1',1, 'D4/2',1, 'E4/3',1, 'E4/3',1, 'E4/3',1, 'E4/3',1,
      'D4/2',1, 'D4/2',1, 'E4/3',1, 'D4/2',1, 'C4/1',4,
    ]),
  },

  happyBirthday: {
    title: 'Happy Birthday',
    composer: 'Traditional',
    bpm: 110,
    // First two lines fingered; third line jumps to high register (left to learner).
    notes: seq('r', 0, [
      'G4/1',0.5, 'G4/1',0.5, 'A4/2',1, 'G4/1',1, 'C5/4',1, 'B4/3',2,
      'G4/1',0.5, 'G4/1',0.5, 'A4/2',1, 'G4/1',1, 'D5/5',1, 'C5/4',2,
      'G4',0.5, 'G4',0.5, 'G5',1, 'E5',1, 'C5',1, 'B4',1, 'A4',1,
      'F5/5',0.5, 'F5/5',0.5, 'E5/3',1, 'C5/1',1, 'D5/2',1, 'C5/1',2,
    ]),
  },

  // --- intermediate -----------------------------------------------------
  odeToJoy: {
    title: 'Ode to Joy (Beethoven Symphony No. 9)',
    composer: 'Beethoven',
    bpm: 108,
    notes: [
      // RH: five-finger C position.
      ...seq('r', 0, [
        'E4/3',1, 'E4/3',1, 'F4/4',1, 'G4/5',1,
        'G4/5',1, 'F4/4',1, 'E4/3',1, 'D4/2',1,
        'C4/1',1, 'C4/1',1, 'D4/2',1, 'E4/3',1,
        'E4/3',1.5, 'D4/2',0.5, 'D4/2',2,
        'E4/3',1, 'E4/3',1, 'F4/4',1, 'G4/5',1,
        'G4/5',1, 'F4/4',1, 'E4/3',1, 'D4/2',1,
        'C4/1',1, 'C4/1',1, 'D4/2',1, 'E4/3',1,
        'D4/2',1.5, 'C4/1',0.5, 'C4/1',2,
        'D4/2',1, 'D4/2',1, 'E4/3',1, 'C4/1',1,
        'D4/2',1, 'E4/3',0.5, 'F4/4',0.5, 'E4/3',1, 'C4/1',1,
        'D4/2',1, 'E4/3',0.5, 'F4/4',0.5, 'E4/3',1, 'D4/2',1,
        'C4/1',1, 'D4/2',1, 'G3/5',2,   // thumb under / slight shift
        'E4/3',1, 'E4/3',1, 'F4/4',1, 'G4/5',1,
        'G4/5',1, 'F4/4',1, 'E4/3',1, 'D4/2',1,
        'C4/1',1, 'C4/1',1, 'D4/2',1, 'E4/3',1,
        'D4/2',1.5, 'C4/1',0.5, 'C4/1',2,
      ]),
      // LH chord accompaniment — fingerings left unset.
      ...seq('l', 0, [
        ['C3','E3','G3'],4, ['C3','E3','G3'],4,
        ['F3','A3','C4'],2, ['C3','G3'],2, ['G2','D3','G3'],4,
        ['C3','E3','G3'],4, ['C3','E3','G3'],4,
        ['F3','A3','C4'],2, ['C3','G3'],2, ['C3','E3','G3'],4,
        ['G2','D3','G3'],4, ['C3','E3','G3'],4,
        ['G2','D3','G3'],4, ['C3','E3','G3'],4,
        ['C3','E3','G3'],4, ['C3','E3','G3'],4,
        ['F3','A3','C4'],2, ['C3','G3'],2, ['C3','E3','G3'],4,
      ]),
    ],
  },

  furElise: {
    title: 'Für Elise (complete — WoO 59)',
    composer: 'Beethoven',
    bpm: 72,
    // Full ABACA rondo form. Beat unit = quarter note; one 3/8 bar = 1.5 beats.
    // Fingerings on A-section RH; B/C sections left unset for learner freedom.
    notes: (() => {
      const all = [];

      // ── Section A ──────────────────────────────────────────────────────────
      // Pickup (0.5) + 13 bars × 1.5 = 20.0 beats.
      function sA(t) {
        all.push(...seq('r', t, [
          'E5/5',0.25,'D#5/4',0.25,                                                            // pickup
          'E5/5',0.25,'D#5/4',0.25,'E5/5',0.25,'B4/1',0.25,'D5/3',0.25,'C5/2',0.25,          // bar 1
          'A4/2',1.5,                                                                           // bar 2
          'r',0.5,'C4/1',0.5,'E4/2',0.5,                                                       // bar 3
          'A4/4',0.5,'B4/5',1.0,                                                                // bar 4
          'r',0.5,'E4/1',0.5,'G#4/2',0.5,                                                      // bar 5
          'B4/4',0.5,'C5/5',1.0,                                                                // bar 6
          'r',0.5,'E4/1',0.5,'E5/5',0.25,'D#5/4',0.25,                                        // bar 7 + pickup
          'E5/5',0.25,'D#5/4',0.25,'E5/5',0.25,'B4/1',0.25,'D5/3',0.25,'C5/2',0.25,          // bar 8
          'A4/2',1.5,                                                                           // bar 9
          'r',0.5,'C4/1',0.5,'E4/2',0.5,                                                       // bar 10
          'A4/4',0.5,'B4/5',1.0,                                                                // bar 11
          'r',0.5,'E4/1',0.5,'C5/5',0.5,                                                       // bar 12
          'B4/4',0.5,'A4/3',1.0,                                                                // bar 13
        ]));
        all.push(...seq('l', t+2.0, [           // LH bars 2–6
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,    // Am
          'E2/5',0.5,'E3/2',0.5,'G#3/1',0.5,   // E
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,    // Am
          'E2/5',0.5,'E3/2',0.5,'G#3/1',0.5,   // E
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,    // Am
        ]));
        all.push(...seq('l', t+12.5, [          // LH bars 9–13
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,
          'E2/5',0.5,'E3/2',0.5,'G#3/1',0.5,
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,
          'E2/5',0.5,'E3/2',0.5,'G#3/1',0.5,
          'A2/5',0.5,'E3/2',0.5,'A3/1',0.5,
        ]));
        return t + 20.0;
      }

      // ── Section B ──────────────────────────────────────────────────────────
      // 21 bars × 1.5 = 31.5 beats. F major → C major → E major (V of Am).
      function sB(t) {
        all.push(...seq('r', t, [
          // Bars 1–8: F major phrase
          'F4',1.0,'C5',0.5,
          'E5',1.5,
          'D5',1.5,
          'C5',0.5,'G4',0.5,'E4',0.5,
          'F4',1.5,
          'r',0.5,'C4',0.5,'E4',0.5,
          'F4',1.0,'C5',0.5,
          'E5',1.5,
          // Bars 9–16: C major phrase
          'D5',1.5,
          'C5',1.0,'G4',0.5,
          'F4',1.5,
          'E4',0.5,'G4',0.5,'C5',0.5,
          'D5',1.5,
          'C5',1.0,'B4',0.5,
          'A4',1.5,
          'r',0.5,'G4',0.5,'F4',0.5,
          // Bars 17–21: E major transition back to Am
          'E4',1.5,
          'r',0.5,'E4',0.5,'G#4',0.5,
          'B4',1.5,
          'C5',0.5,'B4',0.5,'A4',0.5,
          'A4',1.5,
        ]));
        all.push(...seq('l', t, [
          'F2',0.5,'C3',0.5,'F3',0.5,    // F bars 1–5
          'C2',0.5,'G2',0.5,'C3',0.5,
          'F2',0.5,'C3',0.5,'F3',0.5,
          'C2',0.5,'G2',0.5,'C3',0.5,
          'F2',0.5,'C3',0.5,'F3',0.5,
          'F2',0.5,'C3',0.5,'F3',0.5,    // F bars 6–8
          'F2',0.5,'C3',0.5,'F3',0.5,
          'C2',0.5,'G2',0.5,'C3',0.5,
          'C2',0.5,'G2',0.5,'C3',0.5,    // C bars 9–12
          'C2',0.5,'G2',0.5,'C3',0.5,
          'F2',0.5,'C3',0.5,'F3',0.5,
          'C2',0.5,'G2',0.5,'C3',0.5,
          'G2',0.5,'D3',0.5,'G3',0.5,    // G/Am bars 13–16
          'C2',0.5,'G2',0.5,'C3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'F2',0.5,'C3',0.5,'F3',0.5,
          'E2',0.5,'B2',0.5,'E3',0.5,    // E bars 17–21
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'E2',0.5,'E3',0.5,'G#3',0.5,
        ]));
        return t + 31.5;
      }

      // ── Section C ──────────────────────────────────────────────────────────
      // 32 bars × 1.5 = 48 beats. A minor — dramatic development.
      function sC(t) {
        all.push(...seq('r', t, [
          // Part 1: neighbor-note motif (bars 1–8, 12 beats)
          'A4',0.5,'G#4',0.25,'A4',0.25,'C5',0.5,
          'B4',0.5,'G#4',0.25,'A4',0.25,'E5',0.5,
          'A4',0.5,'G#4',0.25,'A4',0.25,'C5',0.5,
          'D5',0.5,'C5',0.25,'B4',0.25,'A4',0.5,
          'A4',0.5,'G#4',0.25,'A4',0.25,'C5',0.5,
          'E5',0.5,'D5',0.5,'C5',0.5,
          'D5',0.5,'C5',0.25,'B4',0.25,'A4',0.5,
          'A4',1.5,
          // Part 2: chromatic descent then ascending run (bars 9–16, 12 beats)
          'A4',0.25,'G#4',0.25,'G4',0.25,'F#4',0.25,'F4',0.25,'E4',0.25,
          'D#4',0.25,'D4',0.25,'C#4',0.25,'C4',0.25,'B3',0.25,'Bb3',0.25,
          'A3',0.25,'B3',0.25,'C4',0.25,'D4',0.25,'E4',0.25,'F4',0.25,
          'G4',0.25,'A4',0.25,'B4',0.25,'C5',0.25,'D5',0.25,'E5',0.25,
          'E5',0.5,'D5',0.25,'C5',0.25,'B4',0.5,
          'A4',0.5,'G#4',0.25,'A4',0.25,'E5',0.5,
          'A5',1.5,
          'G#5',0.5,'A5',0.5,'r',0.5,
          // Part 3: wind-down (bars 17–32, 24 beats)
          'E5',0.5,'D#5',0.25,'E5',0.25,'B4',0.5,
          'C5',0.5,'A4',0.5,'r',0.5,
          'E4',0.25,'F4',0.25,'E4',0.25,'D#4',0.25,'E4',0.25,'B3',0.25,
          'D4',0.25,'C4',0.25,'B3',0.25,'A3',0.25,'G#3',0.25,'A3',0.25,
          'A3',1.5,
          'A3',0.25,'C4',0.25,'E4',0.25,'A4',0.25,'C5',0.25,'E5',0.25,
          'A5',1.5,
          'E5',0.5,'D5',0.5,'C5',0.5,
          'B4',0.5,'A4',0.5,'G#4',0.5,
          'A4',1.5,
          'r',0.5,'E4',0.5,'G#4',0.5,
          'r',0.5,'A4',0.5,'r',0.5,
          'A4',1.5,
          'A4',1.5,
          'r',1.5,
          'r',1.5,
        ]));
        all.push(...seq('l', t, [
          // Part 1: Am broken chords (8 bars)
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          // Part 2: low bass pedal (8 bars)
          'A2',0.5,'A3',0.5,'A4',0.5,
          'A2',0.5,'A3',0.5,'A4',0.5,
          'A2',0.5,'A3',0.5,'A4',0.5,
          'A2',0.5,'A3',0.5,'A4',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          ['A1','E2','A2'],1.5,
          ['A1','E2','A2'],1.5,
          // Part 3: E/Am alternating (16 bars)
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
          'E2',0.5,'E3',0.5,'G#3',0.5,
          'A2',0.5,'E3',0.5,'A3',0.5,
        ]));
        return t + 48.0;
      }

      // ── Assemble: A – B – A – C – A ────────────────────────────────────────
      const t1 = sA(0);      // A1: 0    → 20.0
      const t2 = sB(t1);     // B:  20.0 → 51.5
      const t3 = sA(t2);     // A2: 51.5 → 71.5
      const t4 = sC(t3);     // C:  71.5 → 119.5
      sA(t4);                // A3: 119.5 → 139.5

      return all;
    })(),
  },

  preludeInC: {
    title: 'Prelude in C (WTC Book I, opening)',
    composer: 'J.S. Bach',
    bpm: 72,
    // Bach's arpeggio prelude. Fingering: LH 5-4-2 for ascending bass triad,
    // RH 1-3 for the upper pair, with 2-1 as descending mirror.
    notes: (() => {
      const pattern = (bassLow, bassMid, n1, n2, n3) => [
        [bassLow, 0.25], [bassMid, 0.25], [n1, 0.25], [n2, 0.25],
        [n3, 0.25], [n2, 0.25], [n1, 0.25], [bassMid, 0.25],
        [bassLow, 0.25], [bassMid, 0.25], [n1, 0.25], [n2, 0.25],
        [n3, 0.25], [n2, 0.25], [n1, 0.25], [bassMid, 0.25],
      ];
      const bars = [
        ['C3','E3','G3','C4','E4'],
        ['C3','D3','A3','D4','F4'],
        ['B2','D3','G3','D4','F4'],
        ['C3','E3','G3','C4','E4'],
        ['C3','E3','A3','E4','A4'],
        ['C3','D3','F#3','C4','D4'],
        ['B2','D3','G3','D4','G4'],
        ['B2','C3','E3','G3','C4'],
      ];
      // Fingering varies per bar (different interval structures across the
      // 8 bars), so we only annotate the LH bass & mid reliably. Upper-voice
      // fingering is left unset — consult a printed edition.
      const notes = [];
      bars.forEach((bar, bi) => {
        const [b1,b2,p1,p2,p3] = bar;
        const items = pattern(b1, b2, p1, p2, p3);
        let t = bi * 4;
        items.forEach(([p, d], posIdx) => {
          const isLH = /[2-3]$/.test(p);
          const half = posIdx % 8;
          let finger = null;
          if (isLH) {
            if (half === 0) finger = 5;                // bassLow
            else if (half === 1 || half === 7) finger = 4;   // bassMid
            else finger = 2;                           // the higher LH note
          }
          notes.push({ midi: n(p), start: t, duration: d, hand: isLH ? 'l' : 'r', finger });
          t += d;
        });
      });
      return notes;
    })(),
  },

  minuetInG: {
    title: 'Minuet in G (BWV Anh. 114)',
    composer: 'C. Petzold (attr. Bach)',
    bpm: 120,
    notes: [
      ...seq('r', 0, [
        'D5/5',1, 'G4/1',0.5,'A4/2',0.5, 'B4/3',0.5,'C5/4',0.5,
        'D5/5',1, 'G4/1',1, 'G4/1',1,
        'E5/3',1, 'C5/1',0.5,'D5/2',0.5, 'E5/3',0.5,'F#5/4',0.5,
        'G5/5',1, 'G4/1',1, 'G4/1',1,
        'C5/1',1, 'D5/2',0.5,'C5/1',0.5, 'B4/3',0.5,'A4/2',0.5,
        'B4/3',1, 'C5/4',0.5,'B4/3',0.5, 'A4/2',0.5,'G4/1',0.5,
        'F#4/2',1, 'G4/3',0.5,'A4/4',0.5, 'B4/5',0.5,'G4/3',0.5,
        'A4/2',2, 'rest',1,
      ]),
      // LH chord voicings — fingerings unset.
      ...seq('l', 0, [
        'G3',3,
        ['B2','G3'],1, 'A3',1, 'B3',1,
        'C3',1, ['C3','G3'],1, ['C3','E3'],1,
        ['B2','D3'],1, ['C3','E3'],1, ['D3','F#3'],1,
        ['E3','G3'],1, ['F#3','A3'],1, ['G3','B3'],1,
        ['A3','C4'],1, 'D3',1, 'D4',1,
        'G3',1, 'A3',1, 'B3',1,
        ['D3','A3'],2, 'rest',1,
      ]),
    ],
  },

  moonlightOpening: {
    title: 'Moonlight Sonata Op. 27 No. 2 mvt. I (opening)',
    composer: 'Beethoven',
    bpm: 60,
    // C# minor triplet arpeggios. Standard RH: 1-2-5 for each triplet (spans 5th+).
    // LH: held bass note on pinky.
    notes: (() => {
      const td = 1 / 3;
      const bars = [
        { bass: 'C#2', triplet: ['C#3','E3','G#3'] },
        { bass: 'C#2', triplet: ['C#3','E3','G#3'] },
        { bass: 'A2',  triplet: ['A3','C#4','E4'] },
        { bass: 'D3',  triplet: ['F#3','A3','D4'] },
        { bass: 'G#2', triplet: ['G#3','B#3','D#4'] },
        { bass: 'C#2', triplet: ['C#3','E3','G#3'] },
      ];
      const fingersRH = [1, 2, 5];
      const notes = [];
      bars.forEach((bar, bi) => {
        const barStart = bi * 4;
        notes.push({ midi: n(bar.bass), start: barStart, duration: 4, hand: 'l', finger: 5 });
        for (let g = 0; g < 4; g++) {
          bar.triplet.forEach((p, i) => {
            notes.push({
              midi: n(p), start: barStart + g + i * td, duration: td,
              hand: 'r', finger: fingersRH[i],
            });
          });
        }
      });
      return notes;
    })(),
  },

  canonInD: {
    title: 'Canon in D (simplified melody)',
    composer: 'Pachelbel',
    bpm: 64,
    notes: [
      ...seq('r', 0, [
        // Opening stepwise descent — RH shifts between positions.
        'F#5/5',2, 'E5/4',2, 'D5/3',2, 'C#5/2',2,
        'B4/5',2, 'A4/4',2, 'B4/5',2, 'C#5',2,
        'D5',2, 'C#5',2, 'B4',2, 'A4',2,
        'G4/3',2, 'F#4/2',2, 'G4/3',2, 'E4/1',2,
        // Eighth-note runs
        'F#5/5',1, 'E5/4',1, 'D5/3',1, 'E5/4',1,
        'D5/3',1, 'C#5/2',1, 'D5/3',1, 'F#5/5',1,
        'D5/3',1, 'C#5/2',1, 'B4/1',1, 'C#5/2',1,
        'D5/3',1, 'C#5/2',1, 'B4/1',1, 'A4/1',1,
      ]),
      // LH bass line — fingerings left unset for variety.
      ...seq('l', 0, [
        'D3',4, 'A2',4, 'B2',4, 'F#2',4,
        'G2',4, 'D2',4, 'G2',4, 'A2',4,
      ]),
    ],
  },

  gymnopedie: {
    title: 'Gymnopédie No. 1 (opening)',
    composer: 'Erik Satie',
    bpm: 66,
    notes: [
      // LH waltz accompaniment (chord fingerings unset).
      ...seq('l', 0, [
        'G2',1, ['B3','D4','F#4'],1, ['B3','D4','F#4'],1,
        'D2',1, ['A3','C#4','F#4'],1, ['A3','C#4','F#4'],1,
        'G2',1, ['B3','D4','F#4'],1, ['B3','D4','F#4'],1,
        'D2',1, ['A3','C#4','F#4'],1, ['A3','C#4','F#4'],1,
      ]),
      // RH melody — reaches between F#5 and A5.
      ...seq('r', 6, [
        'F#5/3',3,
        'A5/5',1, 'F#5/3',0.5,'E5/2',0.5, 'D5/1',1,
        'C#5/1',3,
        'D5/2',1, 'E5/3',1, 'F#5/4',1,
      ]),
    ],
  },
};

// Total duration helper (for progress/rendering)
for (const key of Object.keys(SONGS)) {
  const s = SONGS[key];
  let end = 0;
  for (const ev of s.notes) end = Math.max(end, ev.start + ev.duration);
  s.durationBeats = end;
  s.id = key;
}

window.SONGS = SONGS;
