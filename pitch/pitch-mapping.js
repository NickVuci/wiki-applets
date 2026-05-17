import { DEFAULT_RANGE } from "../state/app-state.js";

export const MIN_VISIBLE_RANGE_HZ = 10;
const FREQUENCY_VISIBILITY_TOLERANCE_RATIO = 1e-9;
export const SPECTRUM_STOPS = [
  { color: "#f44336", offset: 0 },
  { color: "#ff9800", offset: 0.16 },
  { color: "#ffeb3b", offset: 0.32 },
  { color: "#4caf50", offset: 0.48 },
  { color: "#00bcd4", offset: 0.64 },
  { color: "#3f51b5", offset: 0.8 },
  { color: "#9c27b0", offset: 0.92 },
  { color: "#f44336", offset: 1 }
];

export function formatHzDisplay(frequency) {
  if (!Number.isFinite(frequency)) {
    return "--\u00A0Hz";
  }

  return `${frequency.toFixed(2)}\u00A0Hz`;
}

export function formatClarity(clarity) {
  if (!Number.isFinite(clarity)) {
    return "--";
  }

  return clarity.toFixed(3);
}

export function validateDisplayRange(minHz, maxHz) {
  if (!Number.isFinite(minHz) || !Number.isFinite(maxHz)) {
    return "Enter valid numeric minimum and maximum Hz values.";
  }

  if (minHz <= 0 || maxHz <= 0) {
    return "Minimum and maximum Hz must both be greater than 0.";
  }

  if (maxHz <= minHz) {
    return "Maximum Hz must be greater than minimum Hz.";
  }

  if (maxHz - minHz < MIN_VISIBLE_RANGE_HZ) {
    return `Choose a range at least ${MIN_VISIBLE_RANGE_HZ} Hz wide.`;
  }

  return "";
}

export function validateTargetFrequency(frequencyHz) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return "Enter a target frequency greater than 0 Hz.";
  }

  return "";
}

export function validateRootFrequency(frequencyHz) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return "Enter a root frequency greater than 0 Hz.";
  }

  return "";
}

export function centsToFrequency(rootHz, cents) {
  return rootHz * 2 ** (cents / 1200);
}

export function ratioToFrequency(rootHz, ratioText) {
  const parsedRatio = parseRatio(ratioText);

  return rootHz * parsedRatio.value;
}

export function ratioToCents(ratioText) {
  const parsedRatio = parseRatio(ratioText);

  return 1200 * Math.log2(parsedRatio.value);
}

export function parseRatio(ratioText) {
  const text = ratioText.trim();
  const parts = text.split("/");

  if (parts.length > 2 || parts.some((part) => part.trim() === "")) {
    throw new Error("Enter a ratio like 3/2 or 1.5.");
  }

  const numerator = Number(parts[0]);
  const denominator = parts.length === 2 ? Number(parts[1]) : 1;

  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    throw new Error("Enter a positive ratio like 3/2 or 1.5.");
  }

  return {
    denominator,
    numerator,
    value: numerator / denominator
  };
}

export function frequencyToNormalizedPosition(frequencyHz, range) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return null;
  }

  const minLog = Math.log2(range.minHz);
  const maxLog = Math.log2(range.maxHz);
  const valueLog = Math.log2(frequencyHz);
  const normalized = (valueLog - minLog) / (maxLog - minLog);

  return Math.max(0, Math.min(1, normalized));
}

export function normalizedPositionToFrequency(position, range) {
  const minLog = Math.log2(range.minHz);
  const maxLog = Math.log2(range.maxHz);
  const valueLog = minLog + position * (maxLog - minLog);

  return 2 ** valueLog;
}

export function isFrequencyVisible(frequency, range) {
  const tolerance = Math.max(range.minHz, range.maxHz) * FREQUENCY_VISIBILITY_TOLERANCE_RATIO;

  return (
    Number.isFinite(frequency) &&
    frequency >= range.minHz - tolerance &&
    frequency <= range.maxHz + tolerance
  );
}

export function buildOctaveSpectrumGradient(range) {
  const gradientStops = [];
  const samples = 96;

  for (let index = 0; index <= samples; index += 1) {
    const position = index / samples;
    const frequency = normalizedPositionToFrequency(position, range);
    const color = getSpectrumColorForFrequency(frequency);

    gradientStops.push(`${color} ${(position * 100).toFixed(3)}%`);
  }

  return `linear-gradient(90deg, ${gradientStops.join(", ")})`;
}

export function getVisibleOctaveFrequencies(range) {
  const octaves = [];
  let frequency = getFirstOctaveBoundary(range.minHz);

  while (frequency < range.minHz) {
    frequency *= 2;
  }

  while (frequency <= range.maxHz) {
    octaves.push(frequency);
    frequency *= 2;
  }

  return octaves;
}

export function getFirstOctaveBoundary(minFrequency) {
  const octaveExponent = Math.floor(Math.log2(minFrequency / DEFAULT_RANGE.minHz));
  return DEFAULT_RANGE.minHz * 2 ** octaveExponent;
}

export function formatFrequencyLabel(frequency) {
  return Number.isInteger(frequency) ? String(frequency) : frequency.toFixed(2);
}

function getSpectrumColorForFrequency(frequency) {
  const octaveBase = getFirstOctaveBoundary(frequency);
  const octaveOffset = Math.log2(frequency / octaveBase);
  const clampedOffset = Math.max(0, Math.min(1, octaveOffset));

  return interpolateSpectrumColor(clampedOffset);
}

function interpolateSpectrumColor(offset) {
  for (let index = 0; index < SPECTRUM_STOPS.length - 1; index += 1) {
    const currentStop = SPECTRUM_STOPS[index];
    const nextStop = SPECTRUM_STOPS[index + 1];

    if (offset < currentStop.offset || offset > nextStop.offset) {
      continue;
    }

    const localOffset = (offset - currentStop.offset) / (nextStop.offset - currentStop.offset);
    return interpolateHexColor(currentStop.color, nextStop.color, localOffset);
  }

  return SPECTRUM_STOPS[SPECTRUM_STOPS.length - 1].color;
}

function interpolateHexColor(startColor, endColor, offset) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const red = Math.round(start.red + (end.red - start.red) * offset);
  const green = Math.round(start.green + (end.green - start.green) * offset);
  const blue = Math.round(start.blue + (end.blue - start.blue) * offset);

  return `rgb(${red} ${green} ${blue})`;
}

function hexToRgb(hexColor) {
  const hex = hexColor.replace("#", "");

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}
