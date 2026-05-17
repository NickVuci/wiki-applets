const TONE_GAIN = 0.14;
const TONE_FADE_SECONDS = 0.02;
const TONE_RAMP_SECONDS = 0.035;

let audioContext = null;
let oscillator = null;
let gainNode = null;
let frequency = null;
let waveform = "sine";

export function isTonePlaying() {
  return oscillator !== null;
}

export function getToneState() {
  return {
    frequency,
    waveform,
    audioState: audioContext?.state ?? "closed",
    isPlaying: isTonePlaying()
  };
}

export async function setToneFrequency(nextFrequency) {
  const context = await resumeToneContext();

  if (!oscillator) {
    startToneGraph(context, nextFrequency);
  } else {
    rampFrequency(nextFrequency);
  }

  frequency = nextFrequency;

  return getToneState();
}

export function setWaveform(nextWaveform) {
  waveform = nextWaveform;

  if (oscillator) {
    oscillator.type = waveform;
  }

  return getToneState();
}

export async function resumeIfNeeded() {
  if (!audioContext || !isTonePlaying()) {
    return getToneState();
  }

  await resumeToneContext();

  return getToneState();
}

export async function stopTone() {
  if (!oscillator || !gainNode || !audioContext) {
    resetToneState();
    return getToneState();
  }

  const stopTime = audioContext.currentTime + TONE_FADE_SECONDS;
  const oscillatorToStop = oscillator;
  const gainToStop = gainNode;

  gainToStop.gain.cancelScheduledValues(audioContext.currentTime);
  gainToStop.gain.setValueAtTime(TONE_GAIN, audioContext.currentTime);
  gainToStop.gain.linearRampToValueAtTime(0, stopTime);
  oscillatorToStop.stop(stopTime);
  oscillatorToStop.onended = () => {
    oscillatorToStop.disconnect();
    gainToStop.disconnect();
  };

  resetToneState();
  await waitForToneFade();
  await closeToneContextIfIdle();

  return getToneState();
}

function startToneGraph(context, nextFrequency) {
  oscillator = context.createOscillator();
  gainNode = context.createGain();

  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(nextFrequency, context.currentTime);
  gainNode.gain.setValueAtTime(0, context.currentTime);
  gainNode.gain.linearRampToValueAtTime(TONE_GAIN, context.currentTime + TONE_FADE_SECONDS);

  // Tone path: oscillator -> gain -> speakers/headphones.
  // This module never connects to the microphone analyzer.
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
}

function rampFrequency(nextFrequency) {
  const now = audioContext.currentTime;

  oscillator.frequency.cancelScheduledValues(now);
  oscillator.frequency.setTargetAtTime(nextFrequency, now, TONE_RAMP_SECONDS);
}

async function resumeToneContext() {
  const context = getToneContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  return context;
}

function getToneContext() {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = createAudioContext();
    audioContext.addEventListener("statechange", () => {
      console.info("Tone AudioContext state:", audioContext.state);
    });
  }

  return audioContext;
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext is not supported in this browser.");
  }

  return new AudioContextConstructor();
}

function resetToneState() {
  oscillator = null;
  gainNode = null;
  frequency = null;
}

function waitForToneFade() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, TONE_FADE_SECONDS * 1000 + 20);
  });
}

async function closeToneContextIfIdle() {
  if (audioContext && !oscillator && audioContext.state !== "closed") {
    await audioContext.close();
    audioContext = null;
  }
}
