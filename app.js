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

const MIN_CLARITY = 0.9;
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 2000;
const SMOOTHING = 0.2;
const LOST_PITCH_FRAMES_BEFORE_RESET = 18;
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

startButton.addEventListener("click", startAnalysis);
stopButton.addEventListener("click", () => stopAnalysis());
stopToneButton.addEventListener("click", stopGeneratedTone);
analysisModeSelect.addEventListener("change", updateAnalysisModeControls);
waveformSelect.addEventListener("change", updateWaveform);
pitchMeter.addEventListener("pointerdown", startToneDrag);
pitchMeter.addEventListener("pointermove", updateToneDrag);
pitchMeter.addEventListener("pointerup", endToneDrag);
pitchMeter.addEventListener("pointercancel", endToneDrag);

resetMicDisplays();
resetToneDisplays();
initializeMeterSpectrum();
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
    syncToneDisplay(getToneState());
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
    pitchDisplay.textContent = "-- Hz";
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

  const displayedPitch = `${smoothedPitch.toFixed(2)} Hz`;
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

  syncToneDisplay(toneState);
}

async function stopGeneratedTone() {
  const toneState = await stopTone();

  syncToneDisplay(toneState);
  applyInternalToneState(toneState);
}

function syncToneDisplay(toneState) {
  if (!toneState.isPlaying || toneState.frequency === null) {
    resetToneDisplays();
    return;
  }

  const displayedPitch = `${toneState.frequency.toFixed(2)} Hz`;
  const waveformLabel = waveformSelect.options[waveformSelect.selectedIndex].text;

  generatedPitchDisplay.textContent = displayedPitch;
  toneStatusDisplay.textContent = `Tone: ${waveformLabel} (${toneState.audioState})`;
  toneMeterLabel.textContent = `Generated: ${displayedPitch}`;
  toneMarker.style.left = `${frequencyToMeterPosition(toneState.frequency) * 100}%`;
  toneMarker.classList.remove("is-hidden");
  stopToneButton.disabled = false;
}

function applyInternalToneState(toneState) {
  if (activeAnalysisMode !== "internal") {
    return;
  }

  if (!toneState.isPlaying || toneState.frequency === null) {
    smoothedPitch = null;
    lostPitchFrames = 0;
    pitchDisplay.textContent = "-- Hz";
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
  generatedPitchDisplay.textContent = "-- Hz";
  toneStatusDisplay.textContent = "Tone: Off";
  toneMeterLabel.textContent = "Generated: Off";
  toneMarker.style.left = "0%";
  toneMarker.classList.add("is-hidden");
  stopToneButton.disabled = true;
}

function resetMicDisplays(statusText = "Idle") {
  pitchDisplay.textContent = "-- Hz";
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = statusText;
  meterLabel.textContent = "Detected: No clear pitch";
  pitchMarker.style.left = "0%";
  pitchMarker.classList.add("is-hidden");
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
  const position = frequencyToMeterPosition(frequency);

  pitchMarker.style.left = `${position * 100}%`;
  pitchMarker.classList.remove("is-hidden");
}

function frequencyToMeterPosition(frequency) {
  const minLog = Math.log2(MIN_FREQUENCY);
  const maxLog = Math.log2(MAX_FREQUENCY);
  const valueLog = Math.log2(frequency);
  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}

function initializeMeterSpectrum() {
  pitchMeter.style.background = buildOctaveSpectrumGradient();
  renderOctaveScale();
}

function buildOctaveSpectrumGradient() {
  const octaveStarts = getOctaveFrequencies();
  const gradientStops = [];

  for (let index = 0; index < octaveStarts.length; index += 1) {
    const segmentStart = octaveStarts[index];
    const segmentEnd = Math.min(segmentStart * 2, MAX_FREQUENCY);
    const startPosition = frequencyToMeterPosition(segmentStart);
    const endPosition = frequencyToMeterPosition(segmentEnd);
    const segmentWidth = endPosition - startPosition;

    for (const stop of SPECTRUM_STOPS) {
      const position = startPosition + segmentWidth * stop.offset;
      gradientStops.push(`${stop.color} ${(position * 100).toFixed(3)}%`);
    }
  }

  return `linear-gradient(90deg, ${gradientStops.join(", ")})`;
}

function renderOctaveScale() {
  const octaveFrequencies = getOctaveFrequencies();

  octaveScale.replaceChildren();

  octaveFrequencies.forEach((frequency, index) => {
    const label = document.createElement("span");
    const position = frequencyToMeterPosition(frequency);

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

function getOctaveFrequencies() {
  const octaves = [];
  let frequency = MIN_FREQUENCY;

  while (frequency <= MAX_FREQUENCY) {
    octaves.push(frequency);
    frequency *= 2;
  }

  return octaves;
}

function formatFrequencyLabel(frequency) {
  return Number.isInteger(frequency) ? String(frequency) : frequency.toFixed(2);
}

function meterPositionToFrequency(position) {
  const minLog = Math.log2(MIN_FREQUENCY);
  const maxLog = Math.log2(MAX_FREQUENCY);
  const valueLog = minLog + position * (maxLog - minLog);

  return 2 ** valueLog;
}

function formatClarity(clarity) {
  if (!Number.isFinite(clarity)) {
    return "--";
  }

  return clarity.toFixed(3);
}
