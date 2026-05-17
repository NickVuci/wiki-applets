export function getDomElements() {
  return {
    audioControls: {
      micToggleButton: getElement("micToggleButton"),
      stopToneButton: getElement("stopToneButton"),
      themeToggleButton: getElement("themeToggleButton"),
      analysisModeSelect: getElement("analysisModeSelect"),
      waveformSelect: getElement("waveformSelect")
    },
    readouts: {
      pitchDisplay: getElement("pitchDisplay"),
      generatedPitchDisplay: getElement("generatedPitchDisplay"),
      clarityDisplay: getElement("clarityDisplay"),
      statusDisplay: getElement("statusDisplay"),
      toneStatusDisplay: getElement("toneStatusDisplay")
    },
    rangeControls: {
      rangePresetSelect: getElement("rangePresetSelect"),
      minHzDisplay: getElement("minHzDisplay"),
      maxHzDisplay: getElement("maxHzDisplay"),
      rangeError: getElement("rangeError")
    },
    targetControls: {
      rootHzControl: getElement("rootHzControl"),
      rootHzInput: getElement("rootHzInput"),
      targetLabelInput: getElement("targetLabelInput"),
      targetInputMode: getElement("targetInputMode"),
      targetValueLabel: getElement("targetValueLabel"),
      targetValueInput: getElement("targetValueInput"),
      addTargetButton: getElement("addTargetButton"),
      clearTargetsButton: getElement("clearTargetsButton"),
      targetError: getElement("targetError")
    },
    scaleControls: {
      sclFileInput: getElement("sclFileInput"),
      sclRootHzInput: getElement("sclRootHzInput"),
      repeatScaleAcrossRangeInput: getElement("repeatScaleAcrossRangeInput"),
      loadScaleButton: getElement("loadScaleButton"),
      scaleUploadStatus: getElement("scaleUploadStatus")
    },
    meter: {
      pitchMeter: getElement("pitchMeter"),
      pitchMarker: getElement("pitchMarker"),
      toneMarker: getElement("toneMarker")
    }
  };
}

function getElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element;
}
