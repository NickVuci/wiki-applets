import { startAnalyzer, stopAnalyzer } from "./mic-analyzer.js";
import {
  getToneState,
  resumeIfNeeded,
  setToneFrequency,
  setWaveform,
  stopTone
} from "./tone-generator.js";
import {
  addManualTarget,
  createAppState,
  resetDisplayRange as resetStateDisplayRange,
  resetLostPitchFrames,
  resetMicTrackingState,
  setActiveAnalysisMode,
  setCurrentToneState,
  setDisplayRange,
  setSmoothedPitch,
  setToneDragging,
  clearTargets as clearStateTargets,
  incrementLostPitchFrames
} from "./state/app-state.js";
import {
  formatClarity,
  formatHzDisplay,
  normalizedPositionToFrequency,
  validateDisplayRange,
  validateTargetFrequency
} from "./pitch/pitch-mapping.js";
import {
  renderDetectedMarker,
  renderRangeDependentUI,
  renderToneMarker
} from "./views/bar-view.js";

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
const targetLabelInput = document.getElementById("targetLabelInput");
const targetHzInput = document.getElementById("targetHzInput");
const addHzTargetButton = document.getElementById("addHzTargetButton");
const clearTargetsButton = document.getElementById("clearTargetsButton");
const targetError = document.getElementById("targetError");
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
const DETECTION_MIN_FREQUENCY = 50;
const DETECTION_MAX_FREQUENCY = 4000;
const SMOOTHING = 0.2;
const LOST_PITCH_FRAMES_BEFORE_RESET = 18;
const dom = {
  pitchMeter,
  octaveScale,
  pitchMarker,
  toneMarker
};
const state = createAppState(getToneState());

startButton.addEventListener("click", startAnalysis);
stopButton.addEventListener("click", () => stopAnalysis());
stopToneButton.addEventListener("click", stopGeneratedTone);
analysisModeSelect.addEventListener("change", updateAnalysisModeControls);
waveformSelect.addEventListener("change", updateWaveform);
applyRangeButton.addEventListener("click", applyDisplayRange);
resetRangeButton.addEventListener("click", resetDisplayRange);
addHzTargetButton.addEventListener("click", addHzTarget);
clearTargetsButton.addEventListener("click", clearTargets);
pitchMeter.addEventListener("pointerdown", startToneDrag);
pitchMeter.addEventListener("pointermove", updateToneDrag);
pitchMeter.addEventListener("pointerup", endToneDrag);
pitchMeter.addEventListener("pointercancel", endToneDrag);

resetMicDisplays();
resetToneDisplays();
syncRangeInputs();
renderRangeDependentUI(dom, state);
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
    setActiveAnalysisMode(state, "microphone");
    stopButton.disabled = false;
    startButton.disabled = true;
    analysisModeSelect.disabled = true;
    setCurrentToneState(state, getToneState());
    syncToneDisplay(state.currentToneState);
  } catch (error) {
    console.error(error);
    await stopAnalysis("Microphone access denied or unavailable");
  }
}

function startInternalAnalysis() {
  setActiveAnalysisMode(state, "internal");
  resetMicTrackingState(state);
  startButton.disabled = true;
  stopButton.disabled = false;
  analysisModeSelect.disabled = true;
  statusDisplay.textContent = "Internal tone analysis";
  applyInternalToneState(getToneState());
}

async function stopAnalysis(statusText = "Idle") {
  await stopAnalyzer();

  setActiveAnalysisMode(state, null);
  resetMicTrackingState(state);

  resetMicDisplays(statusText);
  startButton.disabled = false;
  stopButton.disabled = true;
  analysisModeSelect.disabled = false;
  updateAnalysisModeControls();
}

function updateDetectedPitch({ frequency, clarity }) {
  clarityDisplay.textContent = `Clarity: ${formatClarity(clarity)}`;

  if (!isUsablePitch(frequency, clarity)) {
    incrementLostPitchFrames(state);
    pitchDisplay.textContent = formatHzDisplay(null);
    statusDisplay.textContent = "No clear pitch detected";
    meterLabel.textContent = "Detected: No clear pitch";
    pitchMarker.classList.add("is-hidden");

    if (state.lostPitchFrames >= LOST_PITCH_FRAMES_BEFORE_RESET) {
      setSmoothedPitch(state, null);
    }

    return;
  }

  resetLostPitchFrames(state);
  setSmoothedPitch(state, smoothPitch(frequency));

  const displayedPitch = formatHzDisplay(state.smoothedPitch);
  pitchDisplay.textContent = displayedPitch;
  statusDisplay.textContent = "Listening...";
  meterLabel.textContent = `Detected: ${displayedPitch}`;
  updateDetectedMeter(state.smoothedPitch);
}

async function startToneDrag(event) {
  event.preventDefault();
  setToneDragging(state, true);
  pitchMeter.setPointerCapture(event.pointerId);
  await setToneFromPointer(event);
}

async function updateToneDrag(event) {
  if (!state.isDraggingTone) {
    return;
  }

  event.preventDefault();
  await setToneFromPointer(event);
}

function endToneDrag(event) {
  if (!state.isDraggingTone) {
    return;
  }

  setToneDragging(state, false);

  if (pitchMeter.hasPointerCapture(event.pointerId)) {
    pitchMeter.releasePointerCapture(event.pointerId);
  }
}

async function setToneFromPointer(event) {
  const position = pointerToMeterPosition(event);
  const frequency = meterPositionToFrequency(position);
  const toneState = await setToneFrequency(frequency);

  setCurrentToneState(state, toneState);
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

  setCurrentToneState(state, toneState);
  syncToneDisplay(toneState);
}

async function stopGeneratedTone() {
  const toneState = await stopTone();

  setCurrentToneState(state, toneState);
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
  renderToneMarker(dom, state);
  stopToneButton.disabled = false;
}

function applyInternalToneState(toneState) {
  if (state.activeAnalysisMode !== "internal") {
    return;
  }

  if (!toneState.isPlaying || toneState.frequency === null) {
    resetMicTrackingState(state);
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
  renderToneMarker(dom, state);
  stopToneButton.disabled = true;
}

function resetMicDisplays(statusText = "Idle") {
  pitchDisplay.textContent = formatHzDisplay(null);
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = statusText;
  meterLabel.textContent = "Detected: No clear pitch";
  renderDetectedMarker(dom, state);
}

function setControlsForStarting() {
  startButton.disabled = true;
  stopButton.disabled = true;
}

function updateAnalysisModeControls() {
  if (state.activeAnalysisMode !== null) {
    return;
  }

  const isInternalMode = analysisModeSelect.value === "internal";

  startButton.textContent = isInternalMode ? "Start Internal" : "Start Analysis";
  stopButton.textContent = isInternalMode ? "Stop Internal" : "Stop Analysis";
}

function addHzTarget() {
  const label = targetLabelInput.value.trim();
  const frequencyHz = Number(targetHzInput.value);
  const validationMessage = validateTargetFrequency(frequencyHz);

  if (validationMessage) {
    targetError.textContent = validationMessage;
    return;
  }

  addManualTarget(state, label, frequencyHz);
  targetError.textContent = "";
  targetLabelInput.value = "";
  targetHzInput.value = "";
  renderRangeDependentUI(dom, state);
}

function clearTargets() {
  clearStateTargets(state);
  targetError.textContent = "";
  renderRangeDependentUI(dom, state);
}

function isUsablePitch(frequency, clarity) {
  return (
    clarity >= MIN_CLARITY &&
    Number.isFinite(frequency) &&
    frequency >= DETECTION_MIN_FREQUENCY &&
    frequency <= DETECTION_MAX_FREQUENCY
  );
}

function smoothPitch(frequency) {
  if (state.smoothedPitch === null) {
    return frequency;
  }

  return state.smoothedPitch * (1 - SMOOTHING) + frequency * SMOOTHING;
}

function updateDetectedMeter(frequency) {
  renderDetectedMarker(dom, state, frequency);
}

function meterPositionToFrequency(position) {
  return normalizedPositionToFrequency(position, state.displayRange);
}

function applyDisplayRange() {
  const nextMin = Number(minHzInput.value);
  const nextMax = Number(maxHzInput.value);
  const validationMessage = validateDisplayRange(nextMin, nextMax);

  if (validationMessage) {
    rangeError.textContent = validationMessage;
    return;
  }

  setDisplayRange(state, {
    minHz: nextMin,
    maxHz: nextMax
  });
  rangeError.textContent = "";
  renderRangeDependentUI(dom, state);
}

function resetDisplayRange() {
  resetStateDisplayRange(state);
  rangeError.textContent = "";
  syncRangeInputs();
  renderRangeDependentUI(dom, state);
}

function syncRangeInputs() {
  minHzInput.value = String(state.displayRange.minHz);
  maxHzInput.value = String(state.displayRange.maxHz);
}
