# MVP Plan: Browser Microphone Pitch Tracker

## Project goal

Build a minimal browser web app that lets a user sing or play a single note into their microphone and see the detected pitch frequency in Hz in real time.

This is the first MVP for a future microtonal ear-training app. Do not implement microtonal targets, note names, games, accounts, recording, or scale/lattice visuals yet. The only required MVP behavior is:

> User presses a button, grants microphone permission, sings or plays a monophonic pitch, and the page displays the detected frequency in Hz.

---

## Core requirements

### Functional requirements

1. The app must run in a modern browser.
2. The app must request microphone permission only after the user clicks a button.
3. The app must show a clear status message:
   - `Idle`
   - `Requesting microphone access...`
   - `Listening...`
   - `No clear pitch detected`
   - `Microphone access denied or unavailable`
4. The app must display the current detected pitch in Hz.
5. The app must display a confidence/clarity value from the detector.
6. The app must suppress unstable readings when clarity is too low.
7. The app must smooth pitch readings so the displayed Hz value does not jump excessively.
8. The app must include a basic visual indicator that moves left/right or up/down according to detected frequency.
9. The app must work for monophonic input only: voice, whistle, single-note strings, single-note woodwinds, single-note brass, etc.
10. The app must not attempt polyphonic chord detection.

### Non-functional requirements

1. Keep the code simple and readable.
2. Use vanilla HTML, CSS, and JavaScript.
3. Use no frontend framework.
4. Use Pitchy for pitch detection.
5. Use the Web Audio API for microphone capture and audio analysis.
6. Use ES modules.
7. Include comments explaining the audio signal path.
8. Keep functions small and named clearly.
9. Make it easy to replace Pitchy with another pitch detector later.

---

## Recommended stack

- HTML
- CSS
- JavaScript ES modules
- Web Audio API
- Pitchy

Use Pitchy because it is a focused JavaScript pitch-detection library designed for real-time tuner-style applications.

Pitchy package:
https://github.com/ianprime0509/pitchy

Relevant browser APIs:
- `navigator.mediaDevices.getUserMedia({ audio: true })`
- `AudioContext`
- `MediaStreamAudioSourceNode`
- `AnalyserNode`
- `AnalyserNode.getFloatTimeDomainData()`
- `requestAnimationFrame()`

---

## Project structure

Create this structure:

```text
microtonal-pitch-tracker/
  index.html
  style.css
  app.js
  README.md
```

Optional if using a local dev server with npm:

```text
microtonal-pitch-tracker/
  package.json
  index.html
  style.css
  app.js
  README.md
```

---

## Implementation approach

### Important browser constraint

Microphone access requires a secure context. The app should be run from:

- `localhost`, or
- an HTTPS-hosted page.

Do not expect microphone access to work reliably from an arbitrary insecure `http://` page.

---

## Phase 1: Build the static page

Create `index.html`.

The page should include:

1. App title:
   - `Microphone Pitch Tracker`
2. Short instruction:
   - `Sing or play one note at a time into your microphone.`
3. Start button:
   - `Start Microphone`
4. Stop button:
   - `Stop`
   - disabled until microphone is running
5. Pitch display:
   - default: `-- Hz`
6. Clarity display:
   - default: `--`
7. Status display:
   - default: `Idle`
8. Simple visual meter:
   - a horizontal track
   - a moving marker
   - label below it saying current Hz or `No clear pitch`

Use semantic IDs so `app.js` can target elements easily:

```html
<button id="startButton">Start Microphone</button>
<button id="stopButton" disabled>Stop</button>

<div id="pitchDisplay">-- Hz</div>
<div id="clarityDisplay">Clarity: --</div>
<div id="statusDisplay">Idle</div>

<div id="pitchMeter">
  <div id="pitchMarker"></div>
</div>
```

---

## Phase 2: Add basic styling

Create `style.css`.

Design goals:

1. Mobile-friendly.
2. Large readable pitch display.
3. Clear button states.
4. Simple meter.

Suggested layout:

- Centered card
- Max width around `600px`
- Large pitch number
- Buttons in one row
- Meter below display

No complex design work is needed for the MVP.

---

## Phase 3: Set up JavaScript module

Create `app.js`.

Use an ES module import for Pitchy.

Preferred CDN import for the simplest MVP:

```js
import { PitchDetector } from "https://esm.sh/pitchy@4";
```

Alternative npm import if using Vite or another bundler:

```js
import { PitchDetector } from "pitchy";
```

For the simplest browser-only MVP, use the CDN import first.

---

## Phase 4: Capture microphone input

In `app.js`, create state variables:

```js
let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let detector = null;
let inputBuffer = null;
let animationFrameId = null;
let smoothedPitch = null;
```

When the user clicks `Start Microphone`:

1. Update status to `Requesting microphone access...`
2. Call:

```js
mediaStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
});
```

3. Create an `AudioContext`.
4. Create a `MediaStreamAudioSourceNode`.
5. Create an `AnalyserNode`.
6. Connect the source to the analyser.
7. Set `analyser.fftSize`.

Recommended starting value:

```js
analyser.fftSize = 2048;
```

If low notes are unstable, later test:

```js
analyser.fftSize = 4096;
```

Then create:

```js
inputBuffer = new Float32Array(analyser.fftSize);
detector = PitchDetector.forFloat32Array(analyser.fftSize);
```

Set status to `Listening...`.

---

## Phase 5: Real-time detection loop

Create a function:

```js
function updatePitch() {
  analyser.getFloatTimeDomainData(inputBuffer);

  const [pitch, clarity] = detector.findPitch(
    inputBuffer,
    audioContext.sampleRate
  );

  updateDisplay(pitch, clarity);

  animationFrameId = requestAnimationFrame(updatePitch);
}
```

Call `updatePitch()` after microphone setup succeeds.

---

## Phase 6: Suppress bad readings

Create constants:

```js
const MIN_CLARITY = 0.9;
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 2000;
```

In `updateDisplay(pitch, clarity)`:

1. If clarity is below `MIN_CLARITY`, show:
   - pitch: `-- Hz`
   - status: `No clear pitch detected`
2. If pitch is outside the allowed frequency range, ignore it.
3. Otherwise display the pitch.

Example logic:

```js
const isUsablePitch =
  clarity >= MIN_CLARITY &&
  Number.isFinite(pitch) &&
  pitch >= MIN_FREQUENCY &&
  pitch <= MAX_FREQUENCY;
```

---

## Phase 7: Smooth the pitch display

Raw pitch values can jitter. Use exponential smoothing.

Create:

```js
const SMOOTHING = 0.2;
```

When a usable pitch is detected:

```js
if (smoothedPitch === null) {
  smoothedPitch = pitch;
} else {
  smoothedPitch = smoothedPitch * (1 - SMOOTHING) + pitch * SMOOTHING;
}
```

Display:

```js
pitchDisplay.textContent = `${smoothedPitch.toFixed(2)} Hz`;
```

When pitch is lost for a while, reset `smoothedPitch` to `null`.

---

## Phase 8: Add simple visual pitch meter

Use a frequency range of 50 Hz to 2000 Hz for the MVP.

Because pitch perception is logarithmic, map the pitch position logarithmically.

Create:

```js
function frequencyToMeterPosition(frequency) {
  const minHz = 50;
  const maxHz = 2000;

  const minLog = Math.log2(minHz);
  const maxLog = Math.log2(maxHz);
  const valueLog = Math.log2(frequency);

  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}
```

Then update marker position:

```js
const position = frequencyToMeterPosition(smoothedPitch);
pitchMarker.style.left = `${position * 100}%`;
```

---

## Phase 9: Stop microphone cleanly

When the user clicks `Stop`:

1. Cancel the animation frame.
2. Stop all microphone tracks.
3. Disconnect audio nodes if they exist.
4. Close the audio context.
5. Reset state variables.
6. Reset displays.

Example:

```js
function stopMicrophone() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }

  if (sourceNode) {
    sourceNode.disconnect();
  }

  if (audioContext) {
    audioContext.close();
  }

  audioContext = null;
  analyser = null;
  mediaStream = null;
  sourceNode = null;
  detector = null;
  inputBuffer = null;
  smoothedPitch = null;

  pitchDisplay.textContent = "-- Hz";
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = "Idle";

  startButton.disabled = false;
  stopButton.disabled = true;
}
```

---

## Phase 10: Error handling

Handle at least these cases:

1. Browser does not support `navigator.mediaDevices.getUserMedia`.
2. User denies microphone permission.
3. Microphone exists but cannot be opened.
4. AudioContext creation fails.

Use `try/catch` around microphone startup.

Example status:

```js
statusDisplay.textContent = "Microphone access denied or unavailable";
```

Also log the actual error to the console:

```js
console.error(error);
```

---

## Suggested `app.js` architecture

Use this function structure:

```js
import { PitchDetector } from "https://esm.sh/pitchy@4";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const pitchDisplay = document.getElementById("pitchDisplay");
const clarityDisplay = document.getElementById("clarityDisplay");
const statusDisplay = document.getElementById("statusDisplay");
const pitchMarker = document.getElementById("pitchMarker");

const MIN_CLARITY = 0.9;
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 2000;
const SMOOTHING = 0.2;

let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let detector = null;
let inputBuffer = null;
let animationFrameId = null;
let smoothedPitch = null;

startButton.addEventListener("click", startMicrophone);
stopButton.addEventListener("click", stopMicrophone);

async function startMicrophone() {
  // request microphone
  // create audio context
  // create analyser
  // create Pitchy detector
  // start update loop
}

function updatePitch() {
  // read waveform into inputBuffer
  // call detector.findPitch()
  // update display
  // request next frame
}

function updateDisplay(pitch, clarity) {
  // filter unusable readings
  // smooth usable pitch
  // update Hz text
  // update clarity text
  // update visual meter
}

function frequencyToMeterPosition(frequency) {
  // logarithmic Hz-to-position mapping
}

function stopMicrophone() {
  // stop animation
  // stop mic tracks
  // disconnect/close audio nodes
  // reset UI
}
```

---

## README requirements

Create a `README.md` explaining:

1. What the app does.
2. How to run it locally.
3. Why it needs microphone permission.
4. Browser compatibility notes.
5. Known MVP limitations.

Suggested local run instructions:

### Option A: Python local server

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option B: VS Code Live Server

Use the Live Server extension and open `index.html`.

### Option C: npm/Vite, optional

Only add Vite if needed. Keep the default MVP simple.

---

## Acceptance criteria

The MVP is complete when all of the following are true:

1. Opening the page shows the title, instructions, Start button, Stop button, pitch display, clarity display, status display, and meter.
2. Clicking `Start Microphone` requests microphone permission.
3. Granting permission starts real-time analysis.
4. Singing or playing one stable note displays a frequency in Hz.
5. Silence or noisy input displays `No clear pitch detected`.
6. The clarity value updates in real time.
7. The pitch display is reasonably stable because smoothing is applied.
8. The visual marker moves when the detected pitch changes.
9. Clicking `Stop` stops microphone use and resets the interface.
10. The console has no repeated runtime errors during normal use.

---

## Manual test checklist

Test with:

1. Speaking voice
2. Sung sustained vowel, such as `ah`
3. Whistling
4. Guitar single note
5. Keyboard/synth single sine or piano note
6. Silence
7. Background noise
8. Denying microphone permission
9. Pressing Start, then Stop, then Start again

Expected results:

- Sustained musical tones should show stable Hz.
- Speech may jump around because speech is not always a stable pitch.
- Silence should not show random frequencies.
- Noisy rooms may reduce clarity.
- Chords are not supported.

---

## Future features, not for this MVP

Do not implement these yet, but keep the code architecture open for them:

1. Note names
2. Cents deviation
3. Custom tuning systems
4. Microtonal interval targets
5. Sing-the-target game
6. Interval identification game
7. Scale degree recognition
8. Lattice visualization
9. Tonality diamond visualization
10. EDO target overlays
11. Just intonation ratio targets
12. Calibration reference, such as A4 = 440 Hz or custom root
13. Recording and playback
14. User progress tracking
15. Multiple pitch detector options

---

## Future architecture note

Put Pitchy behind a small detector wrapper so another detector can replace it later.

Example:

```js
function detectPitch(inputBuffer, sampleRate) {
  const [frequency, clarity] = detector.findPitch(inputBuffer, sampleRate);

  return {
    frequency,
    clarity
  };
}
```

The rest of the app should consume this generic return shape:

```js
{
  frequency: number,
  clarity: number
}
```

That way, future algorithms can be swapped in without rewriting the UI.

---

## Important implementation notes

1. Pitch detection should use time-domain audio data, not FFT bin peak picking.
2. This app should assume one pitch at a time.
3. Disable browser audio cleanup features if possible:
   - `echoCancellation: false`
   - `noiseSuppression: false`
   - `autoGainControl: false`
4. Do not connect microphone audio to speakers. The user should not hear their microphone echoed back.
5. Use `requestAnimationFrame()` for UI update timing.
6. Use clarity filtering before displaying pitch.
7. Use smoothing after filtering.
8. Use logarithmic mapping for the visual meter.

---

## Deliverables

Codex should produce:

1. `index.html`
2. `style.css`
3. `app.js`
4. `README.md`

The final app should be a small, readable, browser-based microphone pitch tracker.
