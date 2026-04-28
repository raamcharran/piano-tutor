# Classical Piano Tutor

A browser-based MIDI piano tutor for learning classical pieces on your Casio CT-X700 (or any USB-MIDI keyboard).

## Running it

The easiest way — **double-click `index.html`** to open it in your default browser. Use Chrome or Edge on Windows (Web MIDI isn't available on Firefox/Safari).

If Web MIDI refuses to work from a `file://` URL, run a tiny local server from this folder:

```powershell
# If you have Python installed:
python -m http.server 8080
```

Then open http://localhost:8080 in Chrome/Edge.

## Using it

1. **Connect your Casio CT-X700** via the USB-B→USB-A cable. The top-right status should turn green and show your keyboard's name. If it says "No device detected", unplug/replug the cable and reload the page.
2. **Pick a song** from the dropdown — pieces are roughly ordered from beginner (scales, Twinkle Twinkle) to advanced (Moonlight Sonata, Canon in D).
3. **Pick a mode:**
   - **Learn** — time pauses at each note until you play the right key. Zero pressure, best for first passes.
   - **Practice** — plays at the current tempo; you're scored on accuracy and timing.
   - **Listen** — plays the piece through the Web Audio synth so you can hear how it should sound.
4. **Hands** — restrict practice to right hand only, left hand only, or both.
5. **Tempo** — slower while learning, faster once you know the piece.
6. **Transpose** — shift the whole piece up/down in semitones (e.g. play Für Elise in a different key).
7. Hit **Start**.

## Controls

- Green key = correct note was just played
- Red key = wrong note
- Yellow key = you should play this key right now
- Blue tint on a key = you're currently holding it

Toggle **Key labels** if you're still learning note names. Toggle **Metronome** for a tick on each beat.

## No MIDI device?

You can test with your computer keyboard:

- `Z S X D C V G B H N J M , L . ; /` — C4 octave (black keys above)
- `Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P` — C5 octave

## Troubleshooting

- **MIDI status stuck on "Not connected"** — Make sure no other app (like Casio's software or a DAW) has the keyboard open; only one app can hold the MIDI port at a time.
- **Audio silent** — Click anywhere on the page once to unlock audio (browser policy).
- **Notes slightly off pitch in Listen mode** — That's the built-in simple synth, not the keyboard. Real MIDI input is pitch-accurate.
