export const DEFAULT_RANGE = {
  minHz: 50,
  maxHz: 2000
};

export const DEFAULT_ROOT = {
  label: "Root",
  frequencyHz: 261.63
};

export const DEFAULT_SCALE_NAME = "Manual targets";
export const DEFAULT_PERIOD_RATIO = 2;

export function createAppState(initialToneState) {
  return {
    smoothedPitch: null,
    lostPitchFrames: 0,
    isDraggingTone: false,
    activeAnalysisMode: null,
    displayRange: { ...DEFAULT_RANGE },
    root: { ...DEFAULT_ROOT },
    activeScale: createActiveScale(DEFAULT_SCALE_NAME, DEFAULT_ROOT, []),
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
  syncManualScale(state);
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
  syncManualScale(state);

  return target;
}

export function clearTargets(state) {
  state.pitchTargets = [];
  syncManualScale(state);
}

export function setActiveScale(state, activeScale) {
  const nextScale = {
    name: activeScale.name || DEFAULT_SCALE_NAME,
    rootLabel: activeScale.rootLabel || state.root.label,
    rootHz: activeScale.rootHz || state.root.frequencyHz,
    periodRatio: activeScale.periodRatio || DEFAULT_PERIOD_RATIO,
    degrees: activeScale.degrees || []
  };

  state.root = {
    label: nextScale.rootLabel,
    frequencyHz: nextScale.rootHz
  };
  state.activeScale = nextScale;
  state.pitchTargets = state.activeScale.degrees.map((degree) => scaleDegreeToTarget(degree, state.activeScale));
}

export function syncManualScale(state) {
  state.activeScale = createActiveScale(
    DEFAULT_SCALE_NAME,
    state.root,
    state.pitchTargets.map((target, index) => targetToScaleDegree(target, index, state.root))
  );
}

function createActiveScale(name, root, degrees) {
  return {
    name,
    rootLabel: root.label,
    rootHz: root.frequencyHz,
    periodRatio: DEFAULT_PERIOD_RATIO,
    degrees
  };
}

function targetToScaleDegree(target, index, root) {
  return {
    index,
    label: target.label,
    cents: getTargetCentsFromRoot(target, root.frequencyHz),
    ratio: target.ratio || null,
    frequencyHz: target.frequencyHz,
    targetId: target.id,
    source: target.source
  };
}

function scaleDegreeToTarget(degree, scale) {
  return {
    id: `scale-degree-${String(degree.index).padStart(3, "0")}`,
    label: degree.label,
    frequencyHz: degree.frequencyHz,
    source: "scale-degree",
    colorClass: "target-marker",
    centsFromRoot: degree.cents,
    rootHz: scale.rootHz,
    rootLabel: scale.rootLabel,
    ...(degree.ratio ? { ratio: degree.ratio } : {})
  };
}

function getTargetCentsFromRoot(target, rootHz) {
  if (Number.isFinite(target.centsFromRoot)) {
    return target.centsFromRoot;
  }

  return 1200 * Math.log2(target.frequencyHz / rootHz);
}
