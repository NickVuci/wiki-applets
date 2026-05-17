import { PitchDetector } from "https://esm.sh/pitchy@4";

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const pitchDisplay = document.getElementById("pitchDisplay");
const clarityDisplay = document.getElementById("clarityDisplay");
const statusDisplay = document.getElementById("statusDisplay");
const pitchMarker = document.getElementById("pitchMarker");
const meterLabel = document.getElementById("meterLabel");

const MIN_CLARITY = 0.9;
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 2000;
const SMOOTHING = 0.2;
const LOST_PITCH_FRAMES_BEFORE_RESET = 18;

let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let detector = null;
let inputBuffer = null;
let animationFrameId = null;
let smoothedPitch = null;
let lostPitchFrames = 0;

startButton.addEventListener("click", startMicrophone);
stopButton.addEventListener("click", stopMicrophone);

resetDisplays();

async function startMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showMicrophoneError();
    return;
  }

  setControlsForStarting();
  statusDisplay.textContent = "Requesting microphone access...";

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    audioContext = createAudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    // Audio signal path:
    // microphone stream -> MediaStreamAudioSourceNode -> AnalyserNode.
    // The analyser exposes time-domain samples for Pitchy, and it is not
    // connected to the destination, so microphone audio is never played back.
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);

    inputBuffer = new Float32Array(analyser.fftSize);
    detector = PitchDetector.forFloat32Array(analyser.fftSize);

    statusDisplay.textContent = "Listening...";
    stopButton.disabled = false;
    updatePitch();
  } catch (error) {
    console.error(error);
    await stopMicrophone("Microphone access denied or unavailable");
  }
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  return new AudioContextConstructor();
}

function updatePitch() {
  if (!analyser || !inputBuffer || !audioContext || !detector) {
    return;
  }

  analyser.getFloatTimeDomainData(inputBuffer);

  const result = detectPitch(inputBuffer, audioContext.sampleRate);
  updateDisplay(result.frequency, result.clarity);

  animationFrameId = requestAnimationFrame(updatePitch);
}

function detectPitch(buffer, sampleRate) {
  const [frequency, clarity] = detector.findPitch(buffer, sampleRate);

  return {
    frequency,
    clarity
  };
}

function updateDisplay(frequency, clarity) {
  clarityDisplay.textContent = `Clarity: ${formatClarity(clarity)}`;

  if (!isUsablePitch(frequency, clarity)) {
    lostPitchFrames += 1;
    pitchDisplay.textContent = "-- Hz";
    statusDisplay.textContent = "No clear pitch detected";
    meterLabel.textContent = "No clear pitch";
    pitchMarker.classList.add("is-hidden");

    if (lostPitchFrames >= LOST_PITCH_FRAMES_BEFORE_RESET) {
      smoothedPitch = null;
    }

    return;
  }

  lostPitchFrames = 0;
  smoothedPitch = smoothPitch(frequency);

  const displayedPitch = `${smoothedPitch.toFixed(2)} Hz`;
  pitchDisplay.textContent = displayedPitch;
  statusDisplay.textContent = "Listening...";
  meterLabel.textContent = displayedPitch;
  updateMeter(smoothedPitch);
}

function isUsablePitch(frequency, clarity) {
  return (
    clarity >= MIN_CLARITY &&
    Number.isFinite(frequency) &&
    frequency >= MIN_FREQUENCY &&
    frequency <= MAX_FREQUENCY
  );
}

function smoothPitch(frequency) {
  if (smoothedPitch === null) {
    return frequency;
  }

  return smoothedPitch * (1 - SMOOTHING) + frequency * SMOOTHING;
}

function updateMeter(frequency) {
  const position = frequencyToMeterPosition(frequency);

  pitchMarker.style.left = `${position * 100}%`;
  pitchMarker.classList.remove("is-hidden");
}

function frequencyToMeterPosition(frequency) {
  const minLog = Math.log2(MIN_FREQUENCY);
  const maxLog = Math.log2(MAX_FREQUENCY);
  const valueLog = Math.log2(frequency);
  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}

function formatClarity(clarity) {
  if (!Number.isFinite(clarity)) {
    return "--";
  }

  return clarity.toFixed(3);
}

async function stopMicrophone(statusText = "Idle") {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  if (sourceNode) {
    sourceNode.disconnect();
  }

  if (audioContext && audioContext.state !== "closed") {
    await audioContext.close();
  }

  audioContext = null;
  analyser = null;
  mediaStream = null;
  sourceNode = null;
  detector = null;
  inputBuffer = null;
  smoothedPitch = null;
  lostPitchFrames = 0;

  resetDisplays(statusText);
  startButton.disabled = false;
  stopButton.disabled = true;
}

function resetDisplays(statusText = "Idle") {
  pitchDisplay.textContent = "-- Hz";
  clarityDisplay.textContent = "Clarity: --";
  statusDisplay.textContent = statusText;
  meterLabel.textContent = "No clear pitch";
  pitchMarker.style.left = "0%";
  pitchMarker.classList.add("is-hidden");
}

function setControlsForStarting() {
  startButton.disabled = true;
  stopButton.disabled = true;
}

function showMicrophoneError() {
  resetDisplays("Microphone access denied or unavailable");
  startButton.disabled = false;
  stopButton.disabled = true;
}
