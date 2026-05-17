import { PitchDetector } from "https://esm.sh/pitchy@4";

const ANALYSER_FFT_SIZE = 2048;

let audioContext = null;
let analyser = null;
let mediaStream = null;
let sourceNode = null;
let detector = null;
let inputBuffer = null;
let animationFrameId = null;
let onPitch = null;

export async function startAnalyzer(handlePitch) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not supported in this browser.");
  }

  await stopAnalyzer();

  onPitch = handlePitch;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  audioContext = createAudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = ANALYSER_FFT_SIZE;

  // Microphone path: mic stream -> analyser -> Pitchy.
  // This module never connects microphone input to speakers.
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  sourceNode.connect(analyser);

  inputBuffer = new Float32Array(analyser.fftSize);
  detector = PitchDetector.forFloat32Array(analyser.fftSize);

  updatePitch();

  return getAnalyzerState();
}

export async function stopAnalyzer() {
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
  onPitch = null;

  return getAnalyzerState();
}

export function getAnalyzerState() {
  return {
    audioState: audioContext?.state ?? "closed",
    isListening: mediaStream !== null
  };
}

function updatePitch() {
  if (!analyser || !inputBuffer || !audioContext || !detector || !onPitch) {
    return;
  }

  analyser.getFloatTimeDomainData(inputBuffer);

  const [frequency, clarity] = detector.findPitch(inputBuffer, audioContext.sampleRate);
  onPitch({ frequency, clarity });

  animationFrameId = requestAnimationFrame(updatePitch);
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  const context = new AudioContextConstructor();
  context.addEventListener("statechange", () => {
    console.info("Microphone AudioContext state:", context.state);
  });

  return context;
}
