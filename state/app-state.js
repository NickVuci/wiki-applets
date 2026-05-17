export const DEFAULT_RANGE = {
  minHz: 50,
  maxHz: 2000
};

export const DEFAULT_ROOT = {
  label: "Root",
  frequencyHz: 261.63
};

export function createAppState(initialToneState) {
  return {
    smoothedPitch: null,
    lostPitchFrames: 0,
    isDraggingTone: false,
    activeAnalysisMode: null,
    displayRange: { ...DEFAULT_RANGE },
    root: { ...DEFAULT_ROOT },
    currentToneState: initialToneState,
    pitchTargets: [],
    nextTargetId: 1
  };
}

export function setActiveAnalysisMode(state, mode) {
  state.activeAnalysisMode = mode;
}

export function resetMicTrackingState(state) {
  state.smoothedPitch = null;
  state.lostPitchFrames = 0;
}

export function setSmoothedPitch(state, frequency) {
  state.smoothedPitch = frequency;
}

export function incrementLostPitchFrames(state) {
  state.lostPitchFrames += 1;
  return state.lostPitchFrames;
}

export function resetLostPitchFrames(state) {
  state.lostPitchFrames = 0;
}

export function setToneDragging(state, isDragging) {
  state.isDraggingTone = isDragging;
}

export function setDisplayRange(state, nextRange) {
  state.displayRange = {
    minHz: nextRange.minHz,
    maxHz: nextRange.maxHz
  };
}

export function setRoot(state, nextRoot) {
  state.root = {
    label: nextRoot.label || DEFAULT_ROOT.label,
    frequencyHz: nextRoot.frequencyHz
  };
}

export function resetDisplayRange(state) {
  state.displayRange = { ...DEFAULT_RANGE };
}

export function setCurrentToneState(state, toneState) {
  state.currentToneState = toneState;
}

export function addManualTarget(state, targetInput) {
  const target = {
    id: `target-${String(state.nextTargetId).padStart(3, "0")}`,
    label: targetInput.label || `Target ${state.nextTargetId}`,
    frequencyHz: targetInput.frequencyHz,
    source: targetInput.source,
    colorClass: "target-marker",
    ...(targetInput.centsFromRoot === null || targetInput.centsFromRoot === undefined
      ? {}
      : { centsFromRoot: targetInput.centsFromRoot }),
    ...(targetInput.ratio ? { ratio: targetInput.ratio } : {}),
    ...(targetInput.rootHz ? { rootHz: targetInput.rootHz } : {}),
    ...(targetInput.rootLabel ? { rootLabel: targetInput.rootLabel } : {})
  };

  state.nextTargetId += 1;
  state.pitchTargets = [...state.pitchTargets, target];

  return target;
}

export function clearTargets(state) {
  state.pitchTargets = [];
}
