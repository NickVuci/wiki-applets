import {
  buildOctaveSpectrumGradient,
  formatFrequencyLabel,
  formatHzDisplay,
  frequencyToNormalizedPosition,
  getVisibleOctaveFrequencies,
  isFrequencyVisible
} from "../pitch/pitch-mapping.js";

export function renderRangeDependentUI(dom, state) {
  renderMeterBackground(dom.pitchMeter, state.displayRange);
  if (dom.octaveScale) {
    renderOctaveScale(dom.octaveScale, state.displayRange);
  }
  renderTargetMarkers(dom.pitchMeter, state.pitchTargets, state.displayRange);
  renderMarker(dom.pitchMarker, state.smoothedPitch, state.displayRange);
  renderMarker(dom.toneMarker, state.currentToneState.frequency, state.displayRange);
}

export function renderDetectedMarker(dom, state, frequency = state.smoothedPitch) {
  renderMarker(dom.pitchMarker, frequency, state.displayRange);
}

export function renderToneMarker(dom, state) {
  renderMarker(dom.toneMarker, state.currentToneState.frequency, state.displayRange);
}

function renderMeterBackground(pitchMeter, range) {
  pitchMeter.style.background = buildOctaveSpectrumGradient(range);
}

function renderOctaveScale(octaveScale, range) {
  const octaveFrequencies = getVisibleOctaveFrequencies(range);

  octaveScale.replaceChildren();

  octaveFrequencies.forEach((frequency, index) => {
    const label = document.createElement("span");
    const position = frequencyToNormalizedPosition(frequency, range);

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

function renderTargetMarkers(pitchMeter, pitchTargets, range) {
  const existingMarkers = pitchMeter.querySelectorAll(".target-marker");

  existingMarkers.forEach((marker) => marker.remove());

  pitchTargets.forEach((target) => {
    if (!isFrequencyVisible(target.frequencyHz, range)) {
      return;
    }

    const marker = document.createElement("div");
    const label = document.createElement("span");
    const frequency = document.createElement("span");
    const position = frequencyToNormalizedPosition(target.frequencyHz, range);

    marker.className = "target-marker";
    marker.style.left = `${position * 100}%`;
    marker.title = `${target.label}: ${formatHzDisplay(target.frequencyHz).replace("\u00A0", " ")}`;

    label.className = "target-marker-label";
    label.textContent = target.label;

    frequency.className = "target-marker-frequency";
    frequency.textContent = formatHzDisplay(target.frequencyHz);

    marker.append(label, frequency);
    pitchMeter.append(marker);
  });
}

function renderMarker(markerElement, frequency, range) {
  if (!isFrequencyVisible(frequency, range)) {
    markerElement.style.setProperty("--marker-position", "0%");
    markerElement.classList.add("is-hidden");
    return;
  }

  const position = frequencyToNormalizedPosition(frequency, range);

  markerElement.style.setProperty("--marker-position", `${position * 100}%`);
  markerElement.classList.remove("is-hidden");
}
