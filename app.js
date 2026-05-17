import { startAnalyzer, stopAnalyzer } from "./mic-analyzer.js";
import {
  getToneState,
  resumeIfNeeded,
  setToneFrequency,
  setWaveform,
  stopTone
} from "./tone-generator.js";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const stopToneButton = document.getElementById("stopToneButton");
const analysisModeSelect = document.getElementById("analysisModeSelect");
const waveformSelect = document.getElementById("waveformSelect");
const minHzInput = document.getElementById("minHzInput");
const maxHzInput = document.getElementById("maxHzInput");
const applyRangeButton = document.getElementById("applyRangeButton");
const resetRangeButton = document.getElementById("resetRangeButton");
const rangeError = document.getElementById("rangeError");
const pitchDisplay = document.getElementById("pitchDisplay");
const generatedPitchDisplay = document.getElementById("generatedPitchDisplay");
const clarityDisplay = document.getElementById("clarityDisplay");
const statusDisplay = document.getElementById("statusDisplay");
const toneStatusDisplay = document.getElementById("toneStatusDisplay");
const pitchMeter = document.getElementById("pitchMeter");
const octaveScale = document.getElementById("octaveScale");
const pitchMarker = document.getElementById("pitchMarker");
const toneMarker = document.getElementById("toneMarker");
const meterLabel = document.getElementById("meterLabel");
const toneMeterLabel = document.getElementById("toneMeterLabel");

const DEFAULT_RANGE = {
  minHz: 50,
  maxHz: 2000
};
const MIN_CLARITY = 0.9;
const SMOOTHING = 0.2;
const LOST_PITCH_FRAMES_BEFORE_RESET = 18;
const MIN_VISIBLE_RANGE_OCTAVES = 0.25;
const SPECTRUM_STOPS = [
  { color: "#f44336", offset: 0 },
  { color: "#ff9800", offset: 0.16 },
  { color: "#ffeb3b", offset: 0.32 },
  { color: "#4caf50", offset: 0.48 },
  { color: "#00bcd4", offset: 0.64 },
  { color: "#3f51b5", offset: 0.8 },
  { color: "#9c27b0", offset: 0.92 },
  { color: "#f44336", offset: 1 }
];

let smoothedPitch = null;
let lostPitchFrames = 0;
let isDraggingTone = false;
let activeAnalysisMode = null;
let displayRange = { ...DEFAULT_RANGE };
let currentToneState = getToneState();

startButton.addEventListener("click", startAnalysis);
stopButton.addEventListener("click", () => stopAnalysis());
stopToneButton.addEventListener("click", stopGeneratedTone);
analysisModeSelect.addEventListener("change", updateAnalysisModeControls);
waveformSelect.addEventListener("change", updateWaveform);
applyRangeButton.addEventListener("click", applyDisplayRange);
resetRangeButton.addEventListener("click", resetDisplayRange);
pitchMeter.addEventListener("pointerdown", startToneDrag);
pitchMeter.addEventListener("pointermove", updateToneDrag);
pitchMeter.addEventListener("pointerup", endToneDrag);
pitchMeter.addEventListener("pointercancel", endToneDrag);

resetMicDisplays();
resetToneDisplays();
syncRangeInputs();
renderRangeDependentUI();
updateAnalysisModeControls();

async function startAnalysis() {
  if (analysisModeSelect.value === "internal") {
    startInternalAnalysis();
    return;
  }

  await startMicrophoneAnalysis();
}

async function startMicrophoneAnalysis() {
  setControlsForStarting();
  statusDisplay.textContent = "Requesting microphone access...";

  try {
    await startAnalyzer(updateDetectedPitch);
    await resumeIfNeeded();

    statusDisplay.textContent = "Listening...";
    activeAnalysisMode = "microphone";
    stopButton.disabled = false;
    startButton.disabled = true;
    analysisModeSelect.disabled = true;
    currentToneState = getToneState();
    syncToneDisplay(currentToneState);
  } catch (error) {
    console.error(error);
    await stopAnalysis("Microphone access denied or unavailable");
  }
}

function startInternalAnalysis() {
  activeAnalysisMode = "internal";
  smoothedPitch = null;
  lostPitchFrames = 0;
  startButton.disabled = true;
  stopButton.disabled = false;
  analysisModeSelect.disabled = true;
  statusDisplay.textContent = "Internal tone analysis";
  applyInternalToneState(getToneState());
}

async function stopAnalysis(statusText = "Idle") {
  await stopAnalyzer();

  activeAnalysisMode = null;
  smoothedPitch = null;
  lostPitchFrames = 0;

  resetMicDisplays(statusText);
  startButton.disabled = false;
  stopButton.disabled = true;
  analysisModeSelect.disabled = false;
  updateAnalysisModeControls();
}

function updateDetectedPitch({ frequency, clarity }) {
  clarityDisplay.textContent = `Clarity: ${formatClarity(clarity)}`;

  if (!isUsablePitch(frequency, clarity)) {
    lostPitchFrames += 1;
    pitchDisplay.textContent = formatHzDisplay(null);
    statusDisplay.textContent = "No clear pitch detected";
    meterLabel.textContent = "Detected: No clear pitch";
    pitchMarker.classList.add("is-hidden");

    if (lostPitchFrames >= LOST_PITCH_FRAMES_BEFORE_RESET) {
      smoothedPitch = null;
    }

    return;
  }

  lostPitchFrames = 0;
  smoothedPitch = smoothPitch(frequency);

  const displayedPitch = formatHzDisplay(smoothedPitch);
  pitchDisplay.textContent = displayedPitch;
  statusDisplay.textContent = "Listening...";
  meterLabel.textContent = `Detected: ${displayedPitch}`;
  updateDetectedMeter(smoothedPitch);
}

async function startToneDrag(event) {
  event.preventDefault();
  isDraggingTone = true;
  pitchMeter.setPointerCapture(event.pointerId);
  await setToneFromPointer(event);
}

async function updateToneDrag(event) {
  if (!isDraggingTone) {
    return;
  }

  event.preventDefault();
  await setToneFromPointer(event);
}

function endToneDrag(event) {
  if (!isDraggingTone) {
    return;
  }

  isDraggingTone = false;

  if (pitchMeter.hasPointerCapture(event.pointerId)) {
    pitchMeter.releasePointerCapture(event.pointerId);
  }
}

async function setToneFromPointer(event) {
  const position = pointerToMeterPosition(event);
  const frequency = meterPositionToFrequency(position);
  const toneState = await setToneFrequency(frequency);

  currentToneState = toneState;
  syncToneDisplay(toneState);
  applyInternalToneState(toneState);
}

function pointerToMeterPosition(event) {
  const rect = pitchMeter.getBoundingClientRect();
  const position = (event.clientX - rect.left) / rect.width;

  return Math.max(0, Math.min(1, position));
}

function updateWaveform() {
  const toneState = setWaveform(waveformSelect.value);

  currentToneState = toneState;
  syncToneDisplay(toneState);
}

async function stopGeneratedTone() {
  const toneState = await stopTone();

  currentToneState = toneState;
  syncToneDisplay(toneState);
  applyInternalToneState(toneState);
}

function syncToneDisplay(toneState) {
  if (!toneState.isPlaying || toneState.frequency === null) {
    resetToneDisplays();
    return;
  }

  const displayedPitch = formatHzDisplay(toneState.frequency);
  const waveformLabel = waveformSelect.options[waveformSelect.selectedIndex].text;

  generatedPitchDisplay.textContent = displayedPitch;
  toneStatusDisplay.textContent = `Tone: ${waveformLabel} (${toneState.audioState})`;
  toneMeterLabel.textContent = `Generated: ${displayedPitch}`;
  renderToneMarker();
  stopToneButton.disabled = false;
}

function applyInternalToneState(toneState) {
  if (activeAnalysisMode !== "internal") {
    return;
  }

  if (!toneState.isPlaying || toneState.frequency === null) {
    smoothedPitch = null;
    lostPitchFrames = 0;
    pitchDisplay.textContent = formatHzDisplay(null);
    clarityDisplay.textContent = "Clarity: --";
    statusDisplay.textContent = "Internal mode: click the pitch bar";
    meterLabel.textContent = "Detected: No internal tone";
    pitchMarker.classList.add("is-hidden");
    return;
  }

  updateDetectedPitch({
    frequency: toneState.frequency,
    clarity: 1
  });
  statusDisplay.textContent = "Internal tone analysis";
}

function resetToneDisplays() {
  generatedPitchDisplay.textContent = formatHzDisplay(null);
  toneStatusDisplay.textContent = "Tone: Off";
  toneMeterLabel.textContent = "Generated: Off";
  renderToneMarker();
  stopToneButton.disabled = true;
}

function resetMicDisplays(statusText = "Idle") {
  pitchDisplay.textContent = formatHzDisplay(null);
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = statusText;
  meterLabel.textContent = "Detected: No clear pitch";
  renderDetectedMarker();
}

function setControlsForStarting() {
  startButton.disabled = true;
  stopButton.disabled = true;
}

function updateAnalysisModeControls() {
  if (activeAnalysisMode !== null) {
    return;
  }

  const isInternalMode = analysisModeSelect.value === "internal";

  startButton.textContent = isInternalMode ? "Start Internal" : "Start Analysis";
  stopButton.textContent = isInternalMode ? "Stop Internal" : "Stop Analysis";
}

function isUsablePitch(frequency, clarity) {
  return (
    clarity >= MIN_CLARITY &&
    Number.isFinite(frequency) &&
    frequency >= MIN_FREQUENCY &&
    frequency <= MAX_FREQUENCY
  );
}

function smoothPitch(frequency) {
  if (smoothedPitch === null) {
    return frequency;
  }

  return smoothedPitch * (1 - SMOOTHING) + frequency * SMOOTHING;
}

function updateDetectedMeter(frequency) {
  renderDetectedMarker(frequency);
}

function buildOctaveSpectrumGradient() {
  const gradientStops = [];
  const samples = 96;

  for (let index = 0; index <= samples; index += 1) {
    const position = index / samples;
    const frequency = normalizedPositionToFrequency(position);
    const color = getSpectrumColorForFrequency(frequency);

    gradientStops.push(`${color} ${(position * 100).toFixed(3)}%`);
  }

  return `linear-gradient(90deg, ${gradientStops.join(", ")})`;
}

function renderOctaveScale() {
  const octaveFrequencies = getVisibleOctaveFrequencies();

  octaveScale.replaceChildren();

  octaveFrequencies.forEach((frequency, index) => {
    const label = document.createElement("span");
    const position = frequencyToNormalizedPosition(frequency);

    label.className = "meter-scale-label";
    label.textContent = `${formatFrequencyLabel(frequency)} Hz`;
    label.style.left = `${position * 100}%`;

    if (index === 0) {
      label.classList.add("is-edge-left");
    }

    if (index === octaveFrequencies.length - 1) {
      label.classList.add("is-edge-right");
    }

    if (index % 2 === 1) {
      label.classList.add("is-mobile-hidden");
    }

    octaveScale.append(label);
  });
}

function getOctaveStartFrequencies() {
  const octaves = [];
  let frequency = getFirstOctaveBoundary(displayRange.minHz);

  while (frequency <= displayRange.maxHz) {
    octaves.push(frequency);
    frequency *= 2;
  }

  return octaves;
}

function getVisibleOctaveFrequencies() {
  const octaves = [];
  let frequency = getFirstOctaveBoundary(displayRange.minHz);

  while (frequency < displayRange.minHz) {
    frequency *= 2;
  }

  while (frequency <= displayRange.maxHz) {
    octaves.push(frequency);
    frequency *= 2;
  }

  return octaves;
}

function getFirstOctaveBoundary(minFrequency) {
  const octaveExponent = Math.floor(Math.log2(minFrequency / DEFAULT_RANGE.minHz));
  return DEFAULT_RANGE.minHz * 2 ** octaveExponent;
}

function formatFrequencyLabel(frequency) {
  return Number.isInteger(frequency) ? String(frequency) : frequency.toFixed(2);
}

function formatHzDisplay(frequency) {
  if (!Number.isFinite(frequency)) {
    return "--\u00A0Hz";
  }

  return `${frequency.toFixed(2)}\u00A0Hz`;
}

function meterPositionToFrequency(position) {
  return normalizedPositionToFrequency(position);
}

function frequencyToNormalizedPosition(frequencyHz, range = displayRange) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return null;
  }

  const minLog = Math.log2(range.minHz);
  const maxLog = Math.log2(range.maxHz);
  const valueLog = Math.log2(frequencyHz);
  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}

function normalizedPositionToFrequency(position, range = displayRange) {
  const minLog = Math.log2(range.minHz);
  const maxLog = Math.log2(range.maxHz);
  const valueLog = minLog + position * (maxLog - minLog);

  return 2 ** valueLog;
}

function getSpectrumColorForFrequency(frequency) {
  const octaveBase = getFirstOctaveBoundary(frequency);
  const octaveOffset = Math.log2(frequency / octaveBase);
  const clampedOffset = Math.max(0, Math.min(1, octaveOffset));

  return interpolateSpectrumColor(clampedOffset);
}

function interpolateSpectrumColor(offset) {
  for (let index = 0; index < SPECTRUM_STOPS.length - 1; index += 1) {
    const currentStop = SPECTRUM_STOPS[index];
    const nextStop = SPECTRUM_STOPS[index + 1];

    if (offset < currentStop.offset || offset > nextStop.offset) {
      continue;
    }

    const localOffset = (offset - currentStop.offset) / (nextStop.offset - currentStop.offset);
    return interpolateHexColor(currentStop.color, nextStop.color, localOffset);
  }

  return SPECTRUM_STOPS[SPECTRUM_STOPS.length - 1].color;
}

function interpolateHexColor(startColor, endColor, offset) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const red = Math.round(start.red + (end.red - start.red) * offset);
  const green = Math.round(start.green + (end.green - start.green) * offset);
  const blue = Math.round(start.blue + (end.blue - start.blue) * offset);

  return `rgb(${red} ${green} ${blue})`;
}

function hexToRgb(hexColor) {
  const hex = hexColor.replace("#", "");

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function applyDisplayRange() {
  const nextMin = Number(minHzInput.value);
  const nextMax = Number(maxHzInput.value);
  const validationMessage = validateDisplayRange(nextMin, nextMax);

  if (validationMessage) {
    rangeError.textContent = validationMessage;
    return;
  }

  displayRange = {
    minHz: nextMin,
    maxHz: nextMax
  };
  rangeError.textContent = "";
  renderRangeDependentUI();
}

function resetDisplayRange() {
  displayRange = { ...DEFAULT_RANGE };
  rangeError.textContent = "";
  syncRangeInputs();
  renderRangeDependentUI();
}

function validateDisplayRange(minHz, maxHz) {
  if (!Number.isFinite(minHz) || !Number.isFinite(maxHz)) {
    return "Enter valid numeric minimum and maximum Hz values.";
  }

  if (minHz <= 0 || maxHz <= 0) {
    return "Minimum and maximum Hz must both be greater than 0.";
  }

  if (maxHz <= minHz) {
    return "Maximum Hz must be greater than minimum Hz.";
  }

  if (Math.log2(maxHz / minHz) < MIN_VISIBLE_RANGE_OCTAVES) {
    return "Choose a wider range so the display stays readable.";
  }

  return "";
}

function syncRangeInputs() {
  minHzInput.value = String(displayRange.minHz);
  maxHzInput.value = String(displayRange.maxHz);
}

function renderRangeDependentUI() {
  renderMeterBackground();
  renderOctaveScale();
  renderDetectedMarker();
  renderToneMarker();
}

function renderMeterBackground() {
  pitchMeter.style.background = buildOctaveSpectrumGradient();
}

function renderDetectedMarker(frequency = smoothedPitch) {
  renderMarker(pitchMarker, frequency);
}

function renderToneMarker() {
  renderMarker(toneMarker, currentToneState.frequency);
}

function renderMarker(markerElement, frequency) {
  if (!isFrequencyVisible(frequency)) {
    markerElement.style.left = "0%";
    markerElement.classList.add("is-hidden");
    return;
  }

  const position = frequencyToNormalizedPosition(frequency);

  markerElement.style.left = `${position * 100}%`;
  markerElement.classList.remove("is-hidden");
}

function isFrequencyVisible(frequency) {
  return (
    Number.isFinite(frequency) &&
    frequency >= displayRange.minHz &&
    frequency <= displayRange.maxHz
  );
}

function formatClarity(clarity) {
  if (!Number.isFinite(clarity)) {
    return "--";
  }

  return clarity.toFixed(3);
}
