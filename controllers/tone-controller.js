import {
  setToneFrequency,
  setWaveform,
  stopTone
} from "../tone-generator.js";
import {
  setCurrentToneState,
  setToneDragging
} from "../state/app-state.js";
import {
  formatHzDisplay,
  normalizedPositionToFrequency
} from "../pitch/pitch-mapping.js";
import { renderToneMarker } from "../views/bar-view.js";

export function initToneController({ dom, state, actions }) {
  const { stopToneButton, waveformSelect } = dom.audioControls;
  const { generatedPitchDisplay, toneStatusDisplay } = dom.readouts;
  const { pitchMeter } = dom.meter;

  stopToneButton.addEventListener("click", stopGeneratedTone);
  waveformSelect.addEventListener("change", updateWaveform);
  pitchMeter.addEventListener("pointerdown", startToneDrag);
  pitchMeter.addEventListener("pointermove", updateToneDrag);
  pitchMeter.addEventListener("pointerup", endToneDrag);
  pitchMeter.addEventListener("pointercancel", endToneDrag);

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
    actions.applyInternalToneState?.(toneState);
  }

  function pointerToMeterPosition(event) {
    const rect = pitchMeter.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;

    return Math.max(0, Math.min(1, position));
  }

  function meterPositionToFrequency(position) {
    return normalizedPositionToFrequency(position, state.displayRange);
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
    actions.applyInternalToneState?.(toneState);
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
    renderToneMarker(dom.meter, state);
    stopToneButton.disabled = false;
  }

  function resetToneDisplays() {
    generatedPitchDisplay.textContent = formatHzDisplay(null);
    toneStatusDisplay.textContent = "Tone: Off";
    renderToneMarker(dom.meter, state);
    stopToneButton.disabled = true;
  }

  resetToneDisplays();

  return {
    refreshToneUi: syncToneDisplay,
    resetToneDisplays
  };
}
