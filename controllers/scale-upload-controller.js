import { setActiveScale } from "../state/app-state.js";
import { validateRootFrequency } from "../pitch/pitch-mapping.js";
import {
  buildActiveScaleFromScl,
  parseSclScale
} from "../scale/scl-parser.js";

export function initScaleUploadController({ dom, state, render }) {
  const {
    sclFileInput,
    sclRootHzInput,
    repeatScaleAcrossRangeInput,
    loadScaleButton,
    scaleUploadStatus
  } = dom.scaleControls;

  loadScaleButton.addEventListener("click", loadScaleFromFile);
  sclRootHzInput.addEventListener("keydown", handleScaleRootKeydown);

  async function loadScaleFromFile() {
    const file = sclFileInput.files?.[0];
    const rootHz = Number(sclRootHzInput.value);
    const rootValidationMessage = validateRootFrequency(rootHz);

    if (!file) {
      showScaleError("Choose a .scl file to load.");
      return;
    }

    if (rootValidationMessage) {
      showScaleError(rootValidationMessage);
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
      render.syncRootControls?.();
      syncScaleRootControl();
      dom.targetControls.targetError.textContent = "";
      showScaleSuccess(`Loaded ${activeScale.name} (${activeScale.degrees.length} targets).`);
      render.rangeUi();
    } catch (error) {
      showScaleError(error.message);
    }
  }

  function syncScaleRootControl() {
    sclRootHzInput.value = String(state.root.frequencyHz);
  }

  function showScaleSuccess(message) {
    scaleUploadStatus.classList.remove("is-error");
    scaleUploadStatus.textContent = message;
  }

  function showScaleError(message) {
    scaleUploadStatus.classList.add("is-error");
    scaleUploadStatus.textContent = message;
  }

  function handleScaleRootKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      loadScaleFromFile();
    }
  }

  syncScaleRootControl();

  return {
    loadScaleFromFile,
    syncScaleRootControl
  };
}
