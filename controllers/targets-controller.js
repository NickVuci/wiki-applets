import {
  addManualTarget,
  clearTargets as clearStateTargets,
  setRoot
} from "../state/app-state.js";
import {
  centsToFrequency,
  ratioToCents,
  ratioToFrequency,
  validateRootFrequency,
  validateTargetFrequency
} from "../pitch/pitch-mapping.js";

export function initTargetsController({ dom, state, render }) {
  const {
    rootHzControl,
    rootHzInput,
    targetLabelInput,
    targetInputMode,
    targetValueLabel,
    targetValueInput,
    addTargetButton,
    clearTargetsButton,
    targetError
  } = dom.targetControls;

  rootHzInput.addEventListener("blur", applyRootControls);
  rootHzInput.addEventListener("keydown", handleRootKeydown);
  targetInputMode.addEventListener("change", syncTargetInputMode);
  targetValueInput.addEventListener("keydown", handleTargetKeydown);
  addTargetButton.addEventListener("click", addTarget);
  clearTargetsButton.addEventListener("click", clearTargets);

  function addTarget() {
    const target = buildTargetFromInputs();

    if (!target) {
      return;
    }

    addManualTarget(state, target);
    targetError.textContent = "";
    targetLabelInput.value = "";
    targetValueInput.value = "";
    render.rangeUi();
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
    render.rangeUi();
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

  syncRootControls();
  syncTargetInputMode();

  return {
    applyRootControls,
    syncRootControls,
    syncTargetInputMode
  };
}

function formatIntervalNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
