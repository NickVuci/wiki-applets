import { setDisplayRange } from "../state/app-state.js";
import { validateDisplayRange } from "../pitch/pitch-mapping.js";
import { RANGE_PRESETS } from "../pitch/range-presets.js";

export function initRangeController({ dom, state, render }) {
  const {
    rangePresetSelect,
    minHzDisplay,
    maxHzDisplay,
    rangeError
  } = dom.rangeControls;
  let customDisplayRange = { ...state.displayRange };

  rangePresetSelect.addEventListener("change", applyRangePreset);
  minHzDisplay.addEventListener("blur", handleRangeBlur);
  maxHzDisplay.addEventListener("blur", handleRangeBlur);
  minHzDisplay.addEventListener("keydown", handleRangeKeydown);
  maxHzDisplay.addEventListener("keydown", handleRangeKeydown);

  function applyRangePreset() {
    const preset = RANGE_PRESETS[rangePresetSelect.value];

    if (rangePresetSelect.value === "custom") {
      setDisplayRange(state, customDisplayRange);
      rangeError.textContent = "";
      syncRangeDisplays();
      render.rangeUi();
      return;
    }

    if (!preset) {
      return;
    }

    setDisplayRange(state, preset);
    rangeError.textContent = "";
    syncRangeDisplays();
    render.rangeUi();
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
    syncRangeDisplays();
    render.rangeUi();
  }

  function syncRangeDisplays() {
    minHzDisplay.textContent = String(state.displayRange.minHz);
    maxHzDisplay.textContent = String(state.displayRange.maxHz);
  }

  function getMatchingRangePreset(minHz, maxHz) {
    return Object.entries(RANGE_PRESETS).find(([, preset]) => (
      preset.minHz === minHz && preset.maxHz === maxHz
    ))?.[0] || "";
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

  syncRangeDisplays();

  return {
    applyDisplayRange,
    applyRangePreset,
    syncRangeDisplays
  };
}
