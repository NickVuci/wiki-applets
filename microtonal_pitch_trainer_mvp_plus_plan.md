# Feature Expansion Plan: Microtonal Pitch Trainer MVP+

## Purpose

This document describes the next development plan for an existing browser-based pitch tracker / tone generator web app.

The existing app already has:

- A microphone pitch detector.
- A microphone on/off control.
- A microphone Hz display.
- A tone generator.
- A tone generator on/off control.
- A tone generator Hz display.
- Four oscillator waveforms.
- A bottom horizontal rainbow pitch bar.
- A microphone marker on the bar.
- A tone-generator marker on the bar.
- A fixed visual range from 50 Hz to 2000 Hz.

This plan covers the next feature set:

1. Custom pitch range selection.
2. Scale/target pitch markers on the bottom rainbow bar.
3. Multiple ways to input scale targets.
4. Scale file upload, especially `.scl`.
5. Automatic or semi-automatic range helpers.
6. A second visualization: vertical pitch-over-time view with horizontal target lines and a trailing pitch cursor.
7. A recommended implementation order from easiest to hardest.

---

## Guiding principle

Do not build the advanced training features directly into the microphone or tone-generator code.

Instead, create a shared target/range/visualization layer:

```text
microphone pitch
tone generator pitch
scale targets
custom display range
        ↓
shared pitch model
        ↓
bottom rainbow bar
vertical pitch-trace view
future games/scoring modes
```

The app should treat every pitch-like thing as data:

```js
{
  id: string,
  label: string,
  frequencyHz: number,
  type: "mic" | "tone" | "target" | "scale-degree"
}
```

This prevents the UI from becoming hard-coded around one visualization.

---

## Feature difficulty ranking

| Feature | Difficulty | Recommended order | Reason |
|---|---:|---:|---|
| Custom min/max Hz controls | Easy | 1 | Reuses existing bar mapping logic. |
| Dynamic logarithmic range mapping | Easy | 1 | Required by every later visual feature. |
| Tone/mic markers update after range change | Easy | 1 | Same x-position function with new min/max values. |
| Manual Hz target input | Easy-Medium | 2 | Simplest version of scale targets. |
| Target markers on rainbow bar | Medium | 2 | Requires a target data model and marker rendering. |
| Root Hz input | Medium | 3 | Needed for ratios, cents, and `.scl` import. |
| Manual cents/ratio target input | Medium | 3 | Requires conversion to Hz from root. |
| Scale target list editor | Medium | 3 | Add/delete/clear labels and target frequencies. |
| `.scl` upload | Medium-Hard | 4 | Requires parser and user root-frequency assumptions. |
| Repeating scale targets across range | Medium-Hard | 4 | Need octave/period expansion above and below root. |
| Range presets | Medium | 5 | Easy technically, but requires sensible defaults. |
| Guided range detection | Hard | 6 | Needs a calibration workflow and stable pitch sampling. |
| Vertical pitch-over-time view | Hard | 7 | Requires animation, history buffer, target line rendering, and responsive layout. |
| `.kbm` support | Harder | Later | Requires keyboard mapping logic; not needed for this MVP+. |
| Ear-training scoring/games | Harder | Later | Requires exercises, tolerance rules, and state management. |

---

# Recommended development sequence

## MVP+ Phase 1: Custom frequency range

### Goal

Let the user choose the visible range of the rainbow pitch bar instead of hard-coding 50 Hz to 2000 Hz.

### UI additions

Add a range control panel:

```html
<section id="rangePanel">
  <label>
    Minimum Hz
    <input id="minHzInput" type="number" value="50" min="1" step="1">
  </label>

  <label>
    Maximum Hz
    <input id="maxHzInput" type="number" value="2000" min="1" step="1">
  </label>

  <button id="applyRangeButton">Apply Range</button>
  <button id="resetRangeButton">Reset 50-2000 Hz</button>
</section>
```

### Behavior

1. User enters min and max Hz.
2. User clicks `Apply Range`.
3. Validate:
   - min must be greater than 0.
   - max must be greater than min.
   - range should not be absurdly tiny.
4. Update the global display range.
5. Redraw:
   - rainbow bar labels.
   - microphone marker.
   - tone-generator marker.
   - target markers, once targets exist.

### Data model

Add:

```js
const DEFAULT_RANGE = {
  minHz: 50,
  maxHz: 2000
};

let displayRange = {
  minHz: 50,
  maxHz: 2000
};
```

### Mapping function

Use logarithmic mapping:

```js
function frequencyToNormalizedPosition(frequencyHz, range = displayRange) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;

  const minLog = Math.log2(range.minHz);
  const maxLog = Math.log2(range.maxHz);
  const valueLog = Math.log2(frequencyHz);

  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}
```

Use the same function for:

- mic marker
- tone marker
- scale target markers
- future vertical pitch view y-position

### Acceptance criteria

- Changing min/max Hz changes the visual placement of existing mic/tone markers.
- Invalid ranges show a clear error message.
- Reset restores 50 Hz to 2000 Hz.
- Logarithmic mapping is used, so octaves occupy equal visual width.

---

## MVP+ Phase 2: Manual target markers in Hz

### Goal

Let the user manually add pitch targets in Hz and display them as vertical lines on the rainbow bar.

This is the simplest version of scale support.

### UI additions

```html
<section id="targetPanel">
  <h2>Pitch Targets</h2>

  <label>
    Target label
    <input id="targetLabelInput" type="text" placeholder="C4, 1/1, target 1">
  </label>

  <label>
    Target Hz
    <input id="targetHzInput" type="number" min="1" step="0.01" placeholder="261.63">
  </label>

  <button id="addHzTargetButton">Add Hz Target</button>
  <button id="clearTargetsButton">Clear Targets</button>

  <ul id="targetList"></ul>
</section>
```

### Data model

Add:

```js
let pitchTargets = [];
```

Each target:

```js
{
  id: "target-001",
  label: "C4",
  frequencyHz: 261.63,
  source: "manual-hz",
  colorClass: "target-marker"
}
```

### Rendering

Render target markers as thin vertical lines on the bottom bar:

```text
50 Hz ━━━│━━━━━━│━━━━━━━━│━━━━ 2000 Hz
         A      B        C
```

Targets outside the visible range should either:

1. Not render, or
2. Render as offscreen indicators at the edge.

For MVP+, use option 1: hide out-of-range targets.

### Acceptance criteria

- User can add a target frequency in Hz.
- Target appears as a vertical line on the rainbow bar.
- Target appears in a list.
- User can clear all targets.
- Changing the display range repositions or hides target markers correctly.

---

## MVP+ Phase 3: Root frequency and non-Hz target input

### Goal

Let the user create targets using musical interval formats:

1. Hz
2. Cents above root
3. Ratio above root

### UI additions

Add root controls:

```html
<section id="rootPanel">
  <label>
    Root label
    <input id="rootLabelInput" type="text" value="Root">
  </label>

  <label>
    Root frequency Hz
    <input id="rootHzInput" type="number" value="261.63" min="1" step="0.01">
  </label>
</section>
```

Extend target input:

```html
<select id="targetInputMode">
  <option value="hz">Hz</option>
  <option value="cents">Cents above root</option>
  <option value="ratio">Ratio above root</option>
</select>
```

### Conversion functions

Cents to Hz:

```js
function centsToFrequency(rootHz, cents) {
  return rootHz * 2 ** (cents / 1200);
}
```

Ratio to Hz:

```js
function ratioToFrequency(rootHz, ratioText) {
  const [numText, denText] = ratioText.split("/");
  const numerator = Number(numText);
  const denominator = denText ? Number(denText) : 1;

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    throw new Error("Invalid ratio");
  }

  return rootHz * numerator / denominator;
}
```

### Target examples

```js
[
  {
    id: "target-root",
    label: "1/1",
    frequencyHz: 261.63,
    source: "manual-ratio",
    ratio: "1/1",
    centsFromRoot: 0
  },
  {
    id: "target-fifth",
    label: "3/2",
    frequencyHz: 392.445,
    source: "manual-ratio",
    ratio: "3/2",
    centsFromRoot: 701.955
  },
  {
    id: "target-major-third",
    label: "386.31¢",
    frequencyHz: 327.04,
    source: "manual-cents",
    centsFromRoot: 386.31
  }
]
```

### Acceptance criteria

- User can set a root frequency.
- User can add targets as Hz.
- User can add targets as cents above root.
- User can add targets as ratios above root.
- Invalid ratio or cents input is rejected with a clear message.
- All target types produce the same internal `frequencyHz` field.

---

## MVP+ Phase 4: Scale target layer

### Goal

Create a formal internal model for scale targets so manual input and file upload use the same target system.

### Scale model

Add:

```js
let activeScale = {
  name: "Manual targets",
  rootLabel: "Root",
  rootHz: 261.63,
  periodRatio: 2,
  degrees: []
};
```

Each degree:

```js
{
  index: 0,
  label: "1/1",
  cents: 0,
  ratio: "1/1",
  frequencyHz: 261.63
}
```

For a pure cents degree:

```js
{
  index: 1,
  label: "386.31¢",
  cents: 386.31,
  ratio: null,
  frequencyHz: 327.04
}
```

### Why this phase matters

The app should not treat scale upload as a special display mode. Scale upload should simply populate the same internal `activeScale.degrees` and `pitchTargets` arrays used by manual targets.

### Acceptance criteria

- Manual targets can be converted into an `activeScale`.
- The bottom rainbow bar draws targets from the shared target list.
- Future `.scl` upload can populate the same data model.
- No target-rendering code is duplicated.

---

## MVP+ Phase 5: `.scl` upload

### Goal

Let the user upload a Scala `.scl` scale file and show its scale degrees as target markers on the rainbow bar.

### Important limitation

An `.scl` file defines a scale's interval structure. It does not fully define a performance mapping by itself.

The app must still ask for:

- root frequency in Hz
- root label
- whether to repeat the scale across the visible range
- how many period copies to generate, or simply auto-generate enough copies to fill the visible range

### Reference

The Scala `.scl` format is a human-readable tuning exchange format. Its lines may include cents values or ratios, with comments beginning with `!`.

Reference:
https://www.huygens-fokker.org/scala/scl_format.html

### UI additions

```html
<section id="scaleUploadPanel">
  <h2>Upload Scale</h2>

  <input id="sclFileInput" type="file" accept=".scl,text/plain">

  <label>
    Root frequency Hz
    <input id="sclRootHzInput" type="number" value="261.63" min="1" step="0.01">
  </label>

  <label>
    Root label
    <input id="sclRootLabelInput" type="text" value="1/1">
  </label>

  <label>
    <input id="repeatScaleAcrossRangeInput" type="checkbox" checked>
    Repeat scale across visible range
  </label>

  <button id="loadScaleButton">Load Scale</button>
</section>
```

### Basic `.scl` parser expectations

A simple `.scl` file has:

```text
! comment line
Scale description
12
!
100.0
200.0
300.0
...
2/1
```

Parser rules for MVP+:

1. Ignore blank lines.
2. Ignore comment lines starting with `!`.
3. First non-comment line is the description/name.
4. Second non-comment line is the number of scale degrees.
5. Remaining non-comment lines are intervals.
6. If a line contains `/`, parse it as a ratio.
7. Otherwise parse it as cents.
8. Stop after reading the declared number of degrees.
9. Add a root degree of 0 cents / 1/1 if needed for display.
10. Convert every degree to frequency using root Hz.

### Parser output

```js
{
  name: "Imported scale name",
  degreeCount: 12,
  degrees: [
    {
      index: 0,
      label: "1/1",
      cents: 0,
      ratio: "1/1"
    },
    {
      index: 1,
      label: "100.0¢",
      cents: 100,
      ratio: null
    },
    {
      index: 12,
      label: "2/1",
      cents: 1200,
      ratio: "2/1"
    }
  ]
}
```

### Ratio-to-cents helper

```js
function ratioTextToCents(ratioText) {
  const [numText, denText] = ratioText.split("/");
  const numerator = Number(numText);
  const denominator = denText ? Number(denText) : 1;

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    throw new Error(`Invalid ratio: ${ratioText}`);
  }

  return 1200 * Math.log2(numerator / denominator);
}
```

### Generate repeated targets across visible range

For each scale degree, generate copies by period shifts until the visible range is covered.

For a normal octave-period scale:

```js
copyFrequency = degreeFrequency * 2 ** periodOffset;
```

General period cents version:

```js
copyFrequency = rootHz * 2 ** ((degree.cents + periodOffset * periodCents) / 1200);
```

Start with a default period of 1200 cents.

Later, detect period from the final `.scl` degree if appropriate.

### Acceptance criteria

- User can upload a valid `.scl` file.
- Scale degrees appear as target markers.
- Scale target labels appear in the target list.
- Cents entries and ratio entries both work.
- The root frequency controls the absolute Hz placement.
- Repeated targets fill the selected visible range when enabled.
- Invalid files show a readable error instead of breaking the app.

---

## MVP+ Phase 6: Range presets

### Goal

Let users quickly select a useful display range without manually typing min/max Hz.

### UI additions

```html
<select id="rangePresetSelect">
  <option value="custom">Custom</option>
  <option value="low-voice">Low voice</option>
  <option value="medium-voice">Medium voice</option>
  <option value="high-voice">High voice</option>
  <option value="guitar">Guitar</option>
  <option value="violin">Violin</option>
  <option value="wide">Wide 50-2000 Hz</option>
</select>
```

### Suggested initial presets

Use broad, forgiving values:

```js
const RANGE_PRESETS = {
  "wide": {
    label: "Wide 50-2000 Hz",
    minHz: 50,
    maxHz: 2000
  },
  "low-voice": {
    label: "Low voice",
    minHz: 70,
    maxHz: 400
  },
  "medium-voice": {
    label: "Medium voice",
    minHz: 100,
    maxHz: 700
  },
  "high-voice": {
    label: "High voice",
    minHz: 150,
    maxHz: 1100
  },
  "guitar": {
    label: "Guitar",
    minHz: 70,
    maxHz: 1400
  },
  "violin": {
    label: "Violin",
    minHz: 180,
    maxHz: 3200
  }
};
```

These are not scientific hard limits. They are practical visual presets.

### Acceptance criteria

- Selecting a preset updates min/max range.
- Selecting custom preserves user-entered values.
- Existing mic/tone/target markers redraw correctly.

---

## MVP+ Phase 7: Guided range detection

### Goal

Let users sing or play their lowest and highest comfortable pitch so the app can automatically set the display range.

### UI concept

```text
[Find My Range]

Step 1: Sing/play your lowest comfortable note.
[Capture Low]

Step 2: Sing/play your highest comfortable note.
[Capture High]

Detected range:
Low: 112.4 Hz
High: 486.2 Hz

[Use This Range]
```

### Implementation strategy

Do not try to detect a user's full range automatically with no guidance.

Instead:

1. User clicks `Find My Range`.
2. App asks for lowest comfortable note.
3. User sustains it.
4. App samples stable detected pitches for 1-2 seconds.
5. App uses median pitch as low value.
6. User repeats for highest comfortable note.
7. App adds padding:
   - low range = low * 0.8
   - high range = high * 1.25
8. App applies the padded range.

### Stable pitch sampling

Collect only pitches with:

```js
clarity >= MIN_CLARITY
```

Then use median, not mean, to reduce outliers.

```js
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length === 0) return null;

  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}
```

### Acceptance criteria

- User can capture low pitch.
- User can capture high pitch.
- App rejects captures if too few stable pitch samples are found.
- App calculates padded range.
- User can apply the detected range.
- User can cancel range detection.

---

## MVP+ Phase 8: Vertical pitch-over-time visualization

### Goal

Add a second visualization where:

- pitch is vertical
- time moves horizontally
- scale targets appear as horizontal lines
- the user's live microphone pitch appears as a moving point
- the point leaves a trailing tail behind it

This is the main “sing/play into targets” training view.

### Visual concept

```text
Pitch ↑

2000 Hz ───────────────────────── target
        │
        │                       • current pitch
        │                    •
        │                 •
        │              •
        │           •
 440 Hz ───────────────────────── target
        │
        │
 50 Hz  ───────────────────────────────→ time
```

### UI additions

Add a view switch:

```html
<section id="viewControls">
  <button id="showBarViewButton">Bar View</button>
  <button id="showTraceViewButton">Trace View</button>
</section>
```

Add trace canvas:

```html
<canvas id="pitchTraceCanvas"></canvas>
```

Use `<canvas>` for this view because it is better for repeatedly drawing animated trails than constantly creating DOM elements.

### Pitch history data model

```js
let pitchHistory = [];
```

Each entry:

```js
{
  timeMs: performance.now(),
  frequencyHz: 261.63,
  clarity: 0.94
}
```

### Config

```js
const TRACE_WINDOW_MS = 5000;
const TRACE_MAX_POINTS = 600;
```

### Update logic

When a usable mic pitch is detected:

```js
pitchHistory.push({
  timeMs: performance.now(),
  frequencyHz: smoothedPitch,
  clarity
});
```

Prune old points:

```js
const cutoff = performance.now() - TRACE_WINDOW_MS;
pitchHistory = pitchHistory.filter(point => point.timeMs >= cutoff);
```

### Coordinate mapping

Horizontal position:

```js
function timeToX(timeMs, nowMs, canvasWidth) {
  const ageMs = nowMs - timeMs;
  const normalizedAge = ageMs / TRACE_WINDOW_MS;

  return canvasWidth * (1 - normalizedAge);
}
```

Vertical position:

```js
function frequencyToY(frequencyHz, canvasHeight, range = displayRange) {
  const normalized = frequencyToNormalizedPosition(frequencyHz, range);

  if (normalized === null) return null;

  // y is inverted because canvas y=0 is top
  return canvasHeight * (1 - normalized);
}
```

### Draw order

Each animation frame:

1. Clear canvas.
2. Draw background.
3. Draw horizontal target lines.
4. Draw target labels.
5. Draw pitch trail.
6. Draw current pitch dot.
7. Draw optional Hz label near the current dot.

### Target lines

For each visible target:

```js
const y = frequencyToY(target.frequencyHz, canvas.height);
drawHorizontalLine(y);
drawLabel(target.label, y);
```

### Trail

Draw from oldest to newest points.

For MVP+, a simple line is enough:

```js
ctx.beginPath();

for (const point of pitchHistory) {
  const x = timeToX(point.timeMs, nowMs, canvas.width);
  const y = frequencyToY(point.frequencyHz, canvas.height);

  if (y === null) continue;

  if (firstPoint) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}

ctx.stroke();
```

Later, opacity can fade based on age.

### Acceptance criteria

- User can switch between bar view and trace view.
- Trace view shows target pitch lines.
- Trace view shows the live microphone pitch as a moving dot.
- Recent pitch history trails behind the dot.
- Pitch axis respects the selected display range.
- Out-of-range or unclear pitch does not draw random points.
- Canvas resizes correctly on window resize.

---

# Shared architecture recommendation

## Create a central app state

Use a simple state object:

```js
const appState = {
  displayRange: {
    minHz: 50,
    maxHz: 2000
  },

  root: {
    label: "1/1",
    frequencyHz: 261.63
  },

  mic: {
    enabled: false,
    frequencyHz: null,
    clarity: null
  },

  tone: {
    enabled: false,
    frequencyHz: 261.63,
    waveform: "sine"
  },

  targets: [],

  activeScale: null,

  view: "bar",

  pitchHistory: []
};
```

The UI should render from `appState`.

Avoid scattering state across random variables when adding scale and trace features.

---

## Create these modules if project complexity increases

If the current app is one `app.js`, it can stay that way for Phase 1 and 2.

Once `.scl` and trace view are added, consider splitting:

```text
app.js
audio/
  mic.js
  toneGenerator.js
pitch/
  pitchMapping.js
  targetModel.js
  sclParser.js
views/
  barView.js
  traceView.js
ui/
  rangeControls.js
  targetControls.js
  scaleUploadControls.js
```

For now, Codex can keep this in one file if that is easier, but functions should be named so they can later be moved.

---

# Implementation priority summary

## Do first

1. Custom min/max Hz display range.
2. Shared logarithmic frequency mapping.
3. Manual Hz target markers.
4. Target list add/remove/clear.

These are the easiest and unlock everything else.

## Do second

5. Root frequency setting.
6. Cents target input.
7. Ratio target input.
8. Internal scale/target model.

These establish musical target logic without file parsing.

## Do third

9. `.scl` upload.
10. Parse cents and ratios.
11. Repeat targets across range.

This adds practical xenharmonic scale support.

## Do fourth

12. Range presets.
13. Guided low/high range detection.

Useful, but not necessary before scale targets.

## Do last

14. Vertical pitch-over-time view.
15. Target lines in trace view.
16. Moving dot and trailing tail.

This is the most visually powerful feature, but it should come after targets and ranges are stable.

---

# Codex implementation prompt

Use the following prompt when giving this plan to Codex:

```text
You are modifying an existing vanilla HTML/CSS/JavaScript browser app.

The existing app already has:
- microphone pitch detection
- microphone on/off
- microphone Hz display
- tone generator on/off
- tone generator Hz display
- four oscillator waveforms
- bottom rainbow pitch bar from 50 Hz to 2000 Hz
- vertical mic marker on the pitch bar
- vertical tone-generator marker on the pitch bar

Implement the next feature set in small, safe phases.

Phase 1:
Add custom min/max Hz controls for the bottom rainbow bar. Refactor all pitch-to-position logic into a shared logarithmic mapping function. Existing mic and tone markers must reposition correctly when the range changes.

Phase 2:
Add manual pitch targets in Hz. The user should be able to add, list, and clear targets. Targets should render as vertical markers on the rainbow bar. Targets outside the current display range should be hidden.

Phase 3:
Add a root frequency control and support target input as:
- Hz
- cents above root
- ratio above root

All target types must convert to an internal frequencyHz value and use the same rendering system.

Phase 4:
Add a shared scale/target data model so manual targets and future uploaded scales use the same target system.

Phase 5:
Add .scl file upload. Parse Scala .scl files by ignoring blank lines and comments beginning with !. Treat the first non-comment line as the description, the second as the degree count, and the following lines as scale degrees. Parse lines with / as ratios and other numeric lines as cents. Convert all degrees to target frequencies using the chosen root Hz. Add an option to repeat scale targets across the visible range.

Phase 6:
Add range presets and then a guided range detection workflow where the user captures their lowest and highest comfortable pitch. Use only stable readings above the clarity threshold. Use median pitch for capture and add padding before applying the range.

Phase 7:
Add a second view: vertical pitch-over-time trace. Use canvas. Pitch is vertical, time is horizontal, scale targets are horizontal lines, and the current microphone pitch is a moving dot with a trailing tail. This view must use the same displayRange and targets as the bottom bar.

Keep the code readable. Use vanilla JavaScript only. Do not add a frontend framework. Do not implement ear-training games or scoring yet.
```

---

# Testing checklist

## Range tests

- Set range to 50-2000 Hz.
- Set range to 100-500 Hz.
- Set range to 200-1000 Hz.
- Try invalid range: max below min.
- Try invalid range: negative value.
- Confirm mic/tone/target markers update.

## Target tests

- Add 261.63 Hz.
- Add 440 Hz.
- Add target outside range and confirm it does not render.
- Clear targets.
- Change range and confirm target positions update.

## Root/cents/ratio tests

- Root = 261.63 Hz.
- Add 1200 cents. Expected: about 523.26 Hz.
- Add 3/2. Expected: about 392.445 Hz.
- Add invalid ratio: 3/0. Expected: error.
- Add invalid ratio: abc. Expected: error.

## `.scl` upload tests

- Upload a simple 12-EDO `.scl`.
- Upload a simple JI `.scl` containing ratios.
- Upload a file with comments.
- Upload malformed file and confirm readable error.
- Change root Hz and reload scale.
- Enable repeat across range.
- Disable repeat across range.

## Trace view tests

- Switch to trace view.
- Sing a steady tone.
- Confirm moving dot appears.
- Confirm trail appears.
- Confirm target horizontal lines appear.
- Change display range and confirm y-position changes.
- Stop microphone and confirm trace stops updating.

---

# Explicitly out of scope for this feature pass

Do not implement:

- user accounts
- saved progress
- scoring
- interval quizzes
- note-name systems
- MIDI keyboard input
- `.kbm` support
- `.tun` support
- polyphonic pitch detection
- chord detection
- server/backend/database
- React/Vue/Svelte
- audio recording/export
- automatic full vocal-range discovery without guided capture

---

# References

- Scala `.scl` file format:
  https://www.huygens-fokker.org/scala/scl_format.html

- Web Audio `OscillatorNode.type` waveform options:
  https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode/type

- Web Audio `OscillatorNode`:
  https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode
