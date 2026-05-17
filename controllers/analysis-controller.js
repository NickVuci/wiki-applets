import { startAnalyzer, stopAnalyzer } from "../mic-analyzer.js";
import {
  getToneState,
  resumeIfNeeded
} from "../tone-generator.js";
import {
  incrementLostPitchFrames,
  resetLostPitchFrames,
  resetMicTrackingState,
  setActiveAnalysisMode,
  setCurrentToneState,
  setSmoothedPitch
} from "../state/app-state.js";
import {
  formatClarity,
  formatHzDisplay
} from "../pitch/pitch-mapping.js";
import {
  DETECTION_MAX_FREQUENCY,
  DETECTION_MIN_FREQUENCY,
  LOST_PITCH_FRAMES_BEFORE_RESET,
  MIN_CLARITY,
  SMOOTHING
} from "../pitch/detection-config.js";
import { renderDetectedMarker } from "../views/bar-view.js";

export function initAnalysisController({ dom, state, actions }) {
  const { analysisModeSelect, micToggleButton } = dom.audioControls;
  const { clarityDisplay, pitchDisplay, statusDisplay } = dom.readouts;
  const { pitchMarker } = dom.meter;

  micToggleButton.addEventListener("click", handleMicToggle);
  analysisModeSelect.addEventListener("change", updateAnalysisModeControls);

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
      actions.refreshToneUi?.(state.currentToneState);
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

  function resetMicDisplays(statusText = "Idle") {
    pitchDisplay.textContent = formatHzDisplay(null);
    clarityDisplay.textContent = "Clarity: --";
    statusDisplay.textContent = statusText;
    renderDetectedMarker(dom.meter, state);
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
    renderDetectedMarker(dom.meter, state, frequency);
  }

  resetMicDisplays();
  updateAnalysisModeControls();

  return {
    applyInternalToneState,
    resetMicDisplays,
    startAnalysis,
    stopAnalysis,
    updateAnalysisModeControls,
    updateDetectedPitch
  };
}
