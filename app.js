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
  resetLostPitchFrames,
  resetMicTrackingState,
  setActiveAnalysisMode,
  setActiveScale,
  setCurrentToneState,
  setDisplayRange,
  setRoot,
  setSmoothedPitch,
  setToneDragging,
  clearTargets as clearStateTargets,
  incrementLostPitchFrames
} from "./state/app-state.js";
import {
  centsToFrequency,
  formatClarity,
  formatHzDisplay,
  normalizedPositionToFrequency,
  ratioToCents,
  ratioToFrequency,
  validateDisplayRange,
  validateRootFrequency,
  validateTargetFrequency
} from "./pitch/pitch-mapping.js";
import {
  renderDetectedMarker,
  renderRangeDependentUI,
  renderToneMarker
} from "./views/bar-view.js";
import {
  buildActiveScaleFromScl,
  parseSclScale
} from "./scale/scl-parser.js";

const micToggleButton = document.getElementById("micToggleButton");
const stopToneButton = document.getElementById("stopToneButton");
const themeToggleButton = document.getElementById("themeToggleButton");
const analysisModeSelect = document.getElementById("analysisModeSelect");
const waveformSelect = document.getElementById("waveformSelect");
const rangePresetSelect = document.getElementById("rangePresetSelect");
const minHzDisplay = document.getElementById("minHzDisplay");
const maxHzDisplay = document.getElementById("maxHzDisplay");
const rangeError = document.getElementById("rangeError");
const rootHzControl = document.getElementById("rootHzControl");
const rootHzInput = document.getElementById("rootHzInput");
const targetLabelInput = document.getElementById("targetLabelInput");
const targetInputMode = document.getElementById("targetInputMode");
const targetValueLabel = document.getElementById("targetValueLabel");
const targetValueInput = document.getElementById("targetValueInput");
const addTargetButton = document.getElementById("addTargetButton");
const clearTargetsButton = document.getElementById("clearTargetsButton");
const targetError = document.getElementById("targetError");
const sclFileInput = document.getElementById("sclFileInput");
const sclRootHzInput = document.getElementById("sclRootHzInput");
const repeatScaleAcrossRangeInput = document.getElementById("repeatScaleAcrossRangeInput");
const loadScaleButton = document.getElementById("loadScaleButton");
const scaleUploadStatus = document.getElementById("scaleUploadStatus");
const pitchDisplay = document.getElementById("pitchDisplay");
const generatedPitchDisplay = document.getElementById("generatedPitchDisplay");
const clarityDisplay = document.getElementById("clarityDisplay");
const statusDisplay = document.getElementById("statusDisplay");
const toneStatusDisplay = document.getElementById("toneStatusDisplay");
const pitchMeter = document.getElementById("pitchMeter");
const pitchMarker = document.getElementById("pitchMarker");
const toneMarker = document.getElementById("toneMarker");

const MIN_CLARITY = 0.9;
const DETECTION_MIN_FREQUENCY = 50;
const DETECTION_MAX_FREQUENCY = 4000;
const SMOOTHING = 0.2;
const LOST_PITCH_FRAMES_BEFORE_RESET = 18;
const THEME_STORAGE_KEY = "microtonal-pitch-trainer-theme";
const RANGE_PRESETS = {
  wide: {
    minHz: 50,
    maxHz: 2000
  },
  "low-voice": {
    minHz: 70,
    maxHz: 400
  },
  "medium-voice": {
    minHz: 100,
    maxHz: 700
  },
  "high-voice": {
    minHz: 150,
    maxHz: 1100
  },
  guitar: {
    minHz: 70,
    maxHz: 1400
  },
  violin: {
    minHz: 180,
    maxHz: 3200
  }
};
const dom = {
  pitchMeter,
  pitchMarker,
  toneMarker
};
const state = createAppState(getToneState());
let customDisplayRange = { ...state.displayRange };

micToggleButton.addEventListener("click", handleMicToggle);
stopToneButton.addEventListener("click", stopGeneratedTone);
themeToggleButton.addEventListener("click", toggleTheme);
analysisModeSelect.addEventListener("change", updateAnalysisModeControls);
waveformSelect.addEventListener("change", updateWaveform);
rangePresetSelect.addEventListener("change", applyRangePreset);
minHzDisplay.addEventListener("blur", handleRangeBlur);
maxHzDisplay.addEventListener("blur", handleRangeBlur);
minHzDisplay.addEventListener("keydown", handleRangeKeydown);
maxHzDisplay.addEventListener("keydown", handleRangeKeydown);
rootHzInput.addEventListener("blur", applyRootControls);
rootHzInput.addEventListener("keydown", handleRootKeydown);
targetInputMode.addEventListener("change", syncTargetInputMode);
targetValueInput.addEventListener("keydown", handleTargetKeydown);
addTargetButton.addEventListener("click", addTarget);
clearTargetsButton.addEventListener("click", clearTargets);
loadScaleButton.addEventListener("click", loadScaleFromFile);
sclRootHzInput.addEventListener("keydown", handleScaleRootKeydown);
pitchMeter.addEventListener("pointerdown", startToneDrag);
pitchMeter.addEventListener("pointermove", updateToneDrag);
pitchMeter.addEventListener("pointerup", endToneDrag);
pitchMeter.addEventListener("pointercancel", endToneDrag);

resetMicDisplays();
resetToneDisplays();
initializeTheme();
syncRangeInputs();
syncRangeDisplays();
syncRootControls();
syncScaleRootControl();
syncTargetInputMode();
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
    analysisModeSelect.disabled = true;
    setCurrentToneState(state, getToneState());
    syncToneDisplay(state.currentToneState);
    syncMicToggleButton();
  } catch (error) {
    console.error(error);
    await stopAnalysis("Microphone access denied or unavailable");
  }
}

function startInternalAnalysis() {
  setActiveAnalysisMode(state, "internal");
  resetMicTrackingState(state);
  analysisModeSelect.disabled = true;
  statusDisplay.textContent = "Internal tone analysis";
  applyInternalToneState(getToneState());
  syncMicToggleButton();
}

async function stopAnalysis(statusText = "Idle") {
  await stopAnalyzer();

  setActiveAnalysisMode(state, null);
  resetMicTrackingState(state);

  resetMicDisplays(statusText);
  analysisModeSelect.disabled = false;
  updateAnalysisModeControls();
  syncMicToggleButton();
}

function updateDetectedPitch({ frequency, clarity }) {
  clarityDisplay.textContent = `Clarity: ${formatClarity(clarity)}`;

  if (!isUsablePitch(frequency, clarity)) {
    incrementLostPitchFrames(state);
    pitchDisplay.textContent = formatHzDisplay(null);
    statusDisplay.textContent = "No clear pitch detected";
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
  renderToneMarker(dom, state);
  stopToneButton.disabled = true;
}

function resetMicDisplays(statusText = "Idle") {
  pitchDisplay.textContent = formatHzDisplay(null);
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = statusText;
  renderDetectedMarker(dom, state);
}

function setControlsForStarting() {
  micToggleButton.disabled = true;
}

function updateAnalysisModeControls() {
  if (state.activeAnalysisMode !== null) {
    return;
  }

  const isInternalMode = analysisModeSelect.value === "internal";

  micToggleButton.textContent = isInternalMode ? "Start Internal" : "Start Analysis";
  micToggleButton.classList.remove("is-stop");
  micToggleButton.disabled = false;
}

function addTarget() {
  const target = buildTargetFromInputs();

  if (!target) {
    return;
  }

  addManualTarget(state, target);
  targetError.textContent = "";
  targetLabelInput.value = "";
  targetValueInput.value = "";
  renderRangeDependentUI(dom, state);
}

function buildTargetFromInputs() {
  const mode = targetInputMode.value;
  const label = targetLabelInput.value.trim();
  const rawValue = targetValueInput.value.trim();

  if (mode === "hz") {
    return buildHzTarget(label, rawValue);
  }

  const rootApplied = applyRootControls();

  if (!rootApplied) {
    return null;
  }

  if (mode === "cents") {
    return buildCentsTarget(label, rawValue);
  }

  if (mode === "ratio") {
    return buildRatioTarget(label, rawValue);
  }

  targetError.textContent = "Choose a valid target input mode.";
  return null;
}

function buildHzTarget(label, rawValue) {
  const frequencyHz = Number(rawValue);
  const validationMessage = validateTargetFrequency(frequencyHz);

  if (validationMessage) {
    targetError.textContent = validationMessage;
    return null;
  }

  return {
    label,
    frequencyHz,
    source: "manual-hz"
  };
}

function buildCentsTarget(label, rawValue) {
  if (rawValue === "") {
    targetError.textContent = "Enter a cents value, for example 386.31.";
    return null;
  }

  const cents = Number(rawValue);

  if (!Number.isFinite(cents)) {
    targetError.textContent = "Enter a cents value, for example 386.31.";
    return null;
  }

  const frequencyHz = centsToFrequency(state.root.frequencyHz, cents);
  const validationMessage = validateTargetFrequency(frequencyHz);

  if (validationMessage) {
    targetError.textContent = validationMessage;
    return null;
  }

  return {
    label: label || `${formatIntervalNumber(cents)} cents`,
    frequencyHz,
    source: "manual-cents",
    centsFromRoot: cents,
    rootHz: state.root.frequencyHz,
    rootLabel: state.root.label
  };
}

function buildRatioTarget(label, rawValue) {
  if (rawValue === "") {
    targetError.textContent = "Enter a ratio like 3/2 or 1.5.";
    return null;
  }

  try {
    const frequencyHz = ratioToFrequency(state.root.frequencyHz, rawValue);
    const validationMessage = validateTargetFrequency(frequencyHz);

    if (validationMessage) {
      targetError.textContent = validationMessage;
      return null;
    }

    return {
      label: label || rawValue,
      frequencyHz,
      source: "manual-ratio",
      ratio: rawValue,
      centsFromRoot: ratioToCents(rawValue),
      rootHz: state.root.frequencyHz,
      rootLabel: state.root.label
    };
  } catch (error) {
    targetError.textContent = error.message;
    return null;
  }
}

function clearTargets() {
  clearStateTargets(state);
  targetError.textContent = "";
  renderRangeDependentUI(dom, state);
}

async function loadScaleFromFile() {
  const file = sclFileInput.files?.[0];
  const rootHz = Number(sclRootHzInput.value);
  const rootValidationMessage = validateRootFrequency(rootHz);

  if (!file) {
    scaleUploadStatus.classList.add("is-error");
    scaleUploadStatus.textContent = "Choose a .scl file to load.";
    return;
  }

  if (rootValidationMessage) {
    scaleUploadStatus.classList.add("is-error");
    scaleUploadStatus.textContent = rootValidationMessage;
    syncScaleRootControl();
    return;
  }

  try {
    const fileText = await file.text();
    const parsedScale = parseSclScale(fileText);
    const activeScale = buildActiveScaleFromScl(parsedScale, {
      displayRange: state.displayRange,
      repeatAcrossRange: repeatScaleAcrossRangeInput.checked,
      rootHz,
      rootLabel: "Root"
    });

    setActiveScale(state, activeScale);
    syncRootControls();
    syncScaleRootControl();
    targetError.textContent = "";
    scaleUploadStatus.classList.remove("is-error");
    scaleUploadStatus.textContent = `Loaded ${activeScale.name} (${activeScale.degrees.length} targets).`;
    renderRangeDependentUI(dom, state);
  } catch (error) {
    scaleUploadStatus.classList.add("is-error");
    scaleUploadStatus.textContent = error.message;
  }
}

function applyRootControls() {
  const nextRootHz = Number(rootHzInput.value);
  const validationMessage = validateRootFrequency(nextRootHz);

  if (validationMessage) {
    targetError.textContent = validationMessage;
    syncRootControls();
    return false;
  }

  setRoot(state, {
    label: "Root",
    frequencyHz: nextRootHz
  });
  syncRootControls();
  targetError.textContent = "";

  return true;
}

function syncRootControls() {
  rootHzInput.value = String(state.root.frequencyHz);
}

function syncScaleRootControl() {
  sclRootHzInput.value = String(state.root.frequencyHz);
}

function syncTargetInputMode() {
  const mode = targetInputMode.value;

  if (mode === "hz") {
    rootHzControl.classList.add("is-hidden");
    targetError.textContent = "";
    targetValueLabel.textContent = "Target Hz";
    targetValueInput.placeholder = "261.63";
    targetValueInput.inputMode = "decimal";
    return;
  }

  rootHzControl.classList.remove("is-hidden");

  if (mode === "cents") {
    targetValueLabel.textContent = "Cents above root";
    targetValueInput.placeholder = "701.955";
    targetValueInput.inputMode = "decimal";
    return;
  }

  targetValueLabel.textContent = "Ratio above root";
  targetValueInput.placeholder = "3/2";
  targetValueInput.inputMode = "text";
}

function formatIntervalNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
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

function applyRangePreset() {
  const preset = RANGE_PRESETS[rangePresetSelect.value];

  if (rangePresetSelect.value === "custom") {
    setDisplayRange(state, customDisplayRange);
    rangeError.textContent = "";
    syncRangeInputs();
    syncRangeDisplays();
    renderRangeDependentUI(dom, state);
    return;
  }

  if (!preset) {
    return;
  }

  setDisplayRange(state, preset);
  rangeError.textContent = "";
  syncRangeInputs();
  syncRangeDisplays();
  renderRangeDependentUI(dom, state);
}

function applyDisplayRange() {
  const nextMin = Number(minHzDisplay.textContent.trim());
  const nextMax = Number(maxHzDisplay.textContent.trim());
  const validationMessage = validateDisplayRange(nextMin, nextMax);

  if (validationMessage) {
    rangeError.textContent = validationMessage;
    syncRangeDisplays();
    return;
  }

  setDisplayRange(state, {
    minHz: nextMin,
    maxHz: nextMax
  });
  customDisplayRange = { ...state.displayRange };
  rangeError.textContent = "";
  rangePresetSelect.value = getMatchingRangePreset(nextMin, nextMax) || "custom";
  syncRangeInputs();
  syncRangeDisplays();
  renderRangeDependentUI(dom, state);
}

function getMatchingRangePreset(minHz, maxHz) {
  return Object.entries(RANGE_PRESETS).find(([, preset]) => (
    preset.minHz === minHz && preset.maxHz === maxHz
  ))?.[0] || "";
}

function syncRangeInputs() {
  syncRangeDisplays();
}

function syncRangeDisplays() {
  minHzDisplay.textContent = String(state.displayRange.minHz);
  maxHzDisplay.textContent = String(state.displayRange.maxHz);
}

function initializeTheme() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const preferredTheme = savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : "light";

  applyTheme(preferredTheme);
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggleButton.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

async function handleMicToggle() {
  if (state.activeAnalysisMode === null) {
    await startAnalysis();
    return;
  }

  await stopAnalysis();
}

function syncMicToggleButton() {
  const isRunning = state.activeAnalysisMode !== null;
  const isInternalMode = state.activeAnalysisMode === "internal" || analysisModeSelect.value === "internal";

  micToggleButton.disabled = false;
  micToggleButton.classList.toggle("is-stop", isRunning);
  micToggleButton.textContent = isRunning
    ? (isInternalMode ? "Stop Internal" : "Stop Analysis")
    : (isInternalMode ? "Start Internal" : "Start Analysis");
}

function handleRangeKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    applyDisplayRange();
    event.currentTarget.blur();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    syncRangeDisplays();
    rangeError.textContent = "";
    event.currentTarget.blur();
  }
}

function handleRangeBlur() {
  applyDisplayRange();
}

function handleRootKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    applyRootControls();
    event.currentTarget.blur();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    syncRootControls();
    targetError.textContent = "";
    event.currentTarget.blur();
  }
}

function handleTargetKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addTarget();
  }
}

function handleScaleRootKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    loadScaleFromFile();
  }
}
