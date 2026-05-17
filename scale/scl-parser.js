import { centsToFrequency, ratioToCents } from "../pitch/pitch-mapping.js";

const DEFAULT_PERIOD_CENTS = 1200;

export function parseSclScale(fileText) {
  const lines = fileText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("!"));

  if (lines.length < 2) {
    throw new Error("This .scl file is missing a scale name or degree count.");
  }

  const name = lines[0];
  const degreeCount = Number(lines[1]);

  if (!Number.isInteger(degreeCount) || degreeCount <= 0) {
    throw new Error("This .scl file has an invalid degree count.");
  }

  const intervalLines = lines.slice(2, 2 + degreeCount);

  if (intervalLines.length < degreeCount) {
    throw new Error(`This .scl file declares ${degreeCount} degrees but has only ${intervalLines.length}.`);
  }

  return {
    name,
    degreeCount,
    degrees: addRootDegree(intervalLines.map(parseDegreeLine))
  };
}

export function buildActiveScaleFromScl(parsedScale, options) {
  const periodCents = getPeriodCents(parsedScale.degrees);
  const sourceDegrees = options.repeatAcrossRange
    ? generateRepeatedDegrees(getRepeatableDegrees(parsedScale.degrees, periodCents), {
      displayRange: options.displayRange,
      periodCents,
      rootHz: options.rootHz
    })
    : parsedScale.degrees;

  return {
    name: parsedScale.name,
    rootLabel: options.rootLabel,
    rootHz: options.rootHz,
    periodRatio: 2 ** (periodCents / 1200),
    degrees: sourceDegrees.map((degree, index) => ({
      index,
      label: degree.label,
      cents: degree.cents,
      ratio: degree.ratio,
      frequencyHz: centsToFrequency(options.rootHz, degree.cents)
    }))
  };
}

function parseDegreeLine(line) {
  if (line.includes("/")) {
    return {
      label: line,
      cents: ratioToCents(line),
      ratio: line
    };
  }

  const cents = Number(line);

  if (!Number.isFinite(cents)) {
    throw new Error(`Invalid cents value: ${line}`);
  }

  return {
    label: `${formatCents(cents)} cents`,
    cents,
    ratio: null
  };
}

function addRootDegree(degrees) {
  const hasRoot = degrees.some((degree) => Math.abs(degree.cents) < 0.000001);

  if (hasRoot) {
    return degrees.map((degree, index) => ({ ...degree, index }));
  }

  return [
    {
      index: 0,
      label: "1/1",
      cents: 0,
      ratio: "1/1"
    },
    ...degrees.map((degree, index) => ({ ...degree, index: index + 1 }))
  ];
}

function generateRepeatedDegrees(degrees, options) {
  const repeatedDegrees = [];
  const usedCents = new Set();
  const minOffset = Math.floor(1200 * Math.log2(options.displayRange.minHz / options.rootHz) / options.periodCents) - 1;
  const maxOffset = Math.ceil(1200 * Math.log2(options.displayRange.maxHz / options.rootHz) / options.periodCents) + 1;

  for (let periodOffset = minOffset; periodOffset <= maxOffset; periodOffset += 1) {
    degrees.forEach((degree) => {
      const cents = degree.cents + periodOffset * options.periodCents;
      const frequencyHz = centsToFrequency(options.rootHz, cents);
      const centsKey = cents.toFixed(6);

      if (
        frequencyHz < options.displayRange.minHz ||
        frequencyHz > options.displayRange.maxHz ||
        usedCents.has(centsKey)
      ) {
        return;
      }

      usedCents.add(centsKey);
      repeatedDegrees.push({
        label: periodOffset === 0 ? degree.label : `${degree.label} ${formatPeriodOffset(periodOffset)}`,
        cents,
        ratio: periodOffset === 0 ? degree.ratio : null
      });
    });
  }

  return repeatedDegrees.sort((a, b) => a.cents - b.cents);
}

function getPeriodCents(degrees) {
  const lastDegree = degrees.at(-1);

  if (!lastDegree || lastDegree.cents <= 0) {
    return DEFAULT_PERIOD_CENTS;
  }

  return lastDegree.cents;
}

function getRepeatableDegrees(degrees, periodCents) {
  const lastDegree = degrees.at(-1);

  if (!lastDegree || Math.abs(lastDegree.cents - periodCents) > 0.000001) {
    return degrees;
  }

  return degrees.slice(0, -1);
}

function formatCents(cents) {
  return Number.isInteger(cents) ? String(cents) : cents.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPeriodOffset(periodOffset) {
  return periodOffset > 0 ? `+${periodOffset}` : String(periodOffset);
}
