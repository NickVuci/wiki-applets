// Constants
const CONSTANTS = {
  BASE_FREQUENCY: 392,
  CONTAINER_SIZE: 600,
  CELL_SIZE: 60,
  FADE_TIME: 0.6,
  QUICK_FADE_TIME: 0.1,
  RAMP_TIME: 0.05, // Increased for smoother note starts
  FADE_OUT_TIME: 0.2,
  GAIN_RESET_TIME: 0.5,
  NOTE_VOLUME: 0.4, // Increased back up since we have compression
  MASTER_VOLUME: 0.6, // Increased master volume with compression protection
  Y_OFFSET: 200,
  LAYOUT_OFFSETS: {
    "11-limit": 240,
    "7-limit": 160,
    "5-limit": 140
  }
};

const baseFreq = CONSTANTS.BASE_FREQUENCY;
const diamond = document.getElementById('diamond');
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Create a compressor to prevent clipping
const compressor = audioCtx.createDynamicsCompressor();
compressor.threshold.setValueAtTime(-24, audioCtx.currentTime); // Start compressing at -24dB
compressor.knee.setValueAtTime(30, audioCtx.currentTime); // Smooth compression curve
compressor.ratio.setValueAtTime(12, audioCtx.currentTime); // Heavy compression ratio
compressor.attack.setValueAtTime(0.003, audioCtx.currentTime); // Fast attack
compressor.release.setValueAtTime(0.25, audioCtx.currentTime); // Medium release

const masterGain = audioCtx.createGain();
masterGain.gain.setValueAtTime(CONSTANTS.MASTER_VOLUME, audioCtx.currentTime);

// Connect: masterGain -> compressor -> destination
masterGain.connect(compressor);
compressor.connect(audioCtx.destination);

const cells = [];
const activeNotes = new Map(); // Map to store active notes by cell

const layouts = {
  "5-limit": [
    { ratio: "3/2", x: 140, y: 0, vec: "0,2" },
    { ratio: "5/4", x: 100, y: 40, vec: "-1,1" },
    { ratio: "6/5", x: 180, y: 40, vec: "1,1" },
    { ratio: "1/1", x: 60, y: 80, vec: "-2,0" },
    { ratio: "1/1", x: 140, y: 80, vec: "0,0" },
    { ratio: "1/1", x: 220, y: 80, vec: "2,0" },
    { ratio: "8/5", x: 100, y: 120, lower: true, vec: "-1,-1" },
    { ratio: "5/3", x: 180, y: 120, lower: true, vec: "1,-1" },
    { ratio: "4/3", x: 140, y: 160, lower: true, vec: "0,-2" }
  ],
  "7-limit": [
    { ratio: "7/4", x: 160, y: 0, vec: "0,3" },
    { ratio: "3/2", x: 120, y: 40, vec: "-1,2" },
    { ratio: "7/5", x: 200, y: 40, vec: "1,2" },
    { ratio: "5/4", x: 80, y: 80, vec: "-2,1" },
    { ratio: "6/5", x: 160, y: 80, vec: "0,1" },
    { ratio: "7/6", x: 240, y: 80, vec: "2,1" },
    { ratio: "1/1", x: 40, y: 120, vec: "-3,0" },
    { ratio: "1/1", x: 120, y: 120, vec: "-1,0" },
    { ratio: "1/1", x: 200, y: 120, vec: "1,0" },
    { ratio: "1/1", x: 280, y: 120, vec: "3,0" },
    { ratio: "8/5", x: 80, y: 160, lower: true, vec: "-2,-1" },
    { ratio: "5/3", x: 160, y: 160, lower: true, vec: "0,-1" },
    { ratio: "12/7", x: 240, y: 160, lower: true, vec: "2,-1" },
    { ratio: "4/3", x: 120, y: 200, lower: true, vec: "-1,-2" },
    { ratio: "10/7", x: 200, y: 200, lower: true, vec: "1,-2" },
    { ratio: "8/7", x: 160, y: 240, lower: true, vec: "0,-3" }
  ],
  "11-limit": [
    { ratio: "7/4", x: 240, y: 0 },
    { ratio: "3/2", x: 200, y: 40 },
    { ratio: "14/9", x: 280, y: 40 },
    { ratio: "11/8", x: 160, y: 80 },
    { ratio: "12/9", x: 240, y: 80 },
    { ratio: "7/5", x: 320, y: 80 },
    { ratio: "5/4", x: 120, y: 120 },
    { ratio: "11/9", x: 200, y: 120 },
    { ratio: "6/5", x: 280, y: 120 },
    { ratio: "14/11", x: 360, y: 120 },
    { ratio: "9/8", x: 80, y: 160 },
    { ratio: "10/9", x: 160, y: 160 },
    { ratio: "11/10", x: 240, y: 160 },
    { ratio: "12/11", x: 320, y: 160 },
    { ratio: "7/6", x: 400, y: 160 },
    { ratio: "1/1", x: 40, y: 200 },
    { ratio: "1/1", x: 120, y: 200 },
    { ratio: "1/1", x: 200, y: 200 },
    { ratio: "1/1", x: 280, y: 200 },
    { ratio: "1/1", x: 360, y: 200 },
    { ratio: "1/1", x: 440, y: 200 },
    { ratio: "16/9", x: 80, y: 240, lower: true },
    { ratio: "9/5", x: 160, y: 240, lower: true },
    { ratio: "20/11", x: 240, y: 240, lower: true },
    { ratio: "11/6", x: 320, y: 240, lower: true },
    { ratio: "12/7", x: 400, y: 240, lower: true },
    { ratio: "8/5", x: 120, y: 280, lower: true },
    { ratio: "18/11", x: 200, y: 280, lower: true },
    { ratio: "5/3", x: 280, y: 280, lower: true },
    { ratio: "11/7", x: 360, y: 280, lower: true },
    { ratio: "16/11", x: 160, y: 320, lower: true },
    { ratio: "9/6", x: 240, y: 320, lower: true },
    { ratio: "10/7", x: 320, y: 320, lower: true },
    { ratio: "4/3", x: 200, y: 360, lower: true },
    { ratio: "9/7", x: 280, y: 360, lower: true },
    { ratio: "8/7", x: 240, y: 400, lower: true }
  ]
};

function parseRatio(r) {
  const [num, den] = r.split("/").map(Number);
  return num / den;
}

function playTone(freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(CONSTANTS.NOTE_VOLUME, now + CONSTANTS.RAMP_TIME);
  gain.gain.linearRampToValueAtTime(0, now + CONSTANTS.FADE_TIME);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + CONSTANTS.FADE_TIME);
}

function playNote(ratioStr, cell, lower) {
  // If Shift is held and this cell already has a sustained note, don't restart it
  if (isShiftHeld && activeNotes.has(cell)) {
    return; // Exit early - don't create clicking by restarting the same note
  }

  // Stop existing note if already active (only for temporary notes or different sustained notes)
  stopExistingNote(cell);

  // Calculate frequency
  const freq = calculateFrequency(ratioStr, lower);

  // Create and configure audio nodes
  const { osc, gain } = createAudioNodes(freq);

  // Handle note timing (sustained vs temporary)
  const noteData = handleNoteTiming(osc, gain);

  // Update visual feedback
  updateVisualFeedback(cell, lower);

  // Store note if sustained (Shift held)
  if (isShiftHeld) {
    activeNotes.set(cell, noteData);
    // Only adjust master volume for sustained notes
    adjustMasterVolume();
  }
}

// Helper function to stop existing notes on the same cell
function stopExistingNote(cell) {
  if (activeNotes.has(cell)) {
    const { osc, gain } = activeNotes.get(cell);
    const now = audioCtx.currentTime;
    gain.gain.linearRampToValueAtTime(0, now + CONSTANTS.QUICK_FADE_TIME);
    osc.stop(now + CONSTANTS.QUICK_FADE_TIME);
    activeNotes.delete(cell);
    // Adjust master volume when a sustained note is removed
    adjustMasterVolume();
  }
}

// Helper function to calculate frequency from ratio and lower flag
function calculateFrequency(ratioStr, lower) {
  let freq = baseFreq * parseRatio(ratioStr);
  if (lower) freq /= 2;
  return freq;
}

// Helper function to create and configure audio nodes
function createAudioNodes(freq) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;

  // Smoother gain ramp to prevent clicks
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(CONSTANTS.NOTE_VOLUME, now + CONSTANTS.RAMP_TIME);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain).connect(masterGain);
  osc.start(now);

  return { osc, gain };
}

// Helper function to handle note timing (sustained vs temporary)
function handleNoteTiming(osc, gain) {
  const now = audioCtx.currentTime;

  if (!isShiftHeld) {
    // Temporary note - fade out after specified time
    gain.gain.linearRampToValueAtTime(0, now + CONSTANTS.FADE_TIME);
    osc.stop(now + CONSTANTS.FADE_TIME);
  }

  return { osc, gain };
}

// Helper function to update visual feedback
function updateVisualFeedback(cell, lower) {
  cell.classList.remove('lower-highlight');
  cell.classList.add('active');

  if (!isShiftHeld) {
    setTimeout(() => {
      cell.classList.remove('active');
      if (lower) cell.classList.add('lower-highlight');
    }, CONSTANTS.FADE_TIME * 1000);
  }
}

// Helper function to adjust master volume to prevent clipping
function adjustMasterVolume() {
  const now = audioCtx.currentTime;
  const activeCount = activeNotes.size;
  
  if (activeCount === 0) {
    // Reset to normal volume when no sustained notes
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(CONSTANTS.MASTER_VOLUME, now + 0.1);
    return;
  }
  
  // More aggressive volume reduction for multiple notes
  // Use exponential scaling to prevent clipping better
  const targetGain = CONSTANTS.MASTER_VOLUME / (1 + activeCount * 0.4);
  
  // Smooth transition to new volume level
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.05);
}

function renderDiamond(limit) {
  diamond.dataset.limit = limit;
  diamond.innerHTML = "";
  const containerWidth = CONSTANTS.CONTAINER_SIZE;
  const containerHeight = CONSTANTS.CONTAINER_SIZE;
  const cellSize = CONSTANTS.CELL_SIZE;
  const centerX = containerWidth / 2 - cellSize / 2;
  const centerY = containerHeight / 2 - cellSize / 2;
  cells.length = 0;
  const layout = layouts[limit];  layout.forEach(({ ratio, x, y, lower }) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    if (lower) {
      cell.classList.add('lower-highlight');
      cell.dataset.lower = 'true';
    }
    const yOffset = CONSTANTS.Y_OFFSET;
    const offset = CONSTANTS.LAYOUT_OFFSETS[limit] || CONSTANTS.LAYOUT_OFFSETS["5-limit"];
    cell.style.left = `${centerX + x - offset}px`;
    cell.style.top = `${centerY + y - yOffset}px`;
    cell.dataset.ratio = ratio;
    const label = document.createElement('span');
    label.textContent = ratio;
    cell.appendChild(label);
    // Remove click event listener - we handle this with pointer events now
    diamond.appendChild(cell);
    cells.push(cell);
  });
}

// Initialize the diamond layout buttons
const limitToggle = document.querySelector('.limit-toggle');
Object.keys(layouts).forEach(limit => {
  const button = document.createElement('button');
  button.textContent = `${limit}`;
  button.onclick = () => renderDiamond(limit);
  limitToggle.appendChild(button);
});

// Initialize with 5-limit diamond
renderDiamond("5-limit");

// Keyboard interaction state
let isShiftHeld = false;

// Keyboard event handlers
document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    isShiftHeld = false;

    // Stop all sustained notes with a smooth fade-out
    activeNotes.forEach(({ osc, gain }, cell) => {
      const now = audioCtx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + CONSTANTS.FADE_OUT_TIME);
      osc.stop(now + CONSTANTS.FADE_OUT_TIME);

      // Clean up visual feedback
      cell.classList.remove('active');
      if (cell.dataset.lower === 'true') {
        cell.classList.add('lower-highlight');
      }
    });

    activeNotes.clear();

    // Reset the master gain smoothly
    const resetTime = audioCtx.currentTime + CONSTANTS.FADE_OUT_TIME;
    masterGain.gain.cancelScheduledValues(resetTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, resetTime);
    masterGain.gain.linearRampToValueAtTime(CONSTANTS.MASTER_VOLUME, resetTime + CONSTANTS.GAIN_RESET_TIME);
  }
});

// Pointer interaction state
let isMouseDown = false; // Track whether the mouse is pressed
let lastActivatedCell = null; // Track the last activated cell to avoid re-triggering
let hasTriggeredOnMouseDown = false; // Flag to prevent duplicate triggering

// Unified pointer handler for both mouse and touch events
function handlePointerStart(clientX, clientY) {
  isMouseDown = true;
  hasTriggeredOnMouseDown = false;
  const element = document.elementFromPoint(clientX, clientY);
  // Check if the element is a cell or is inside a cell
  const cell = element.classList.contains('cell') ? element : element.closest('.cell');
  if (cell) {
    playNote(cell.dataset.ratio, cell, cell.dataset.lower === 'true');
    lastActivatedCell = cell;
    hasTriggeredOnMouseDown = true;
  }
}

function handlePointerMove(clientX, clientY) {
  if (isMouseDown) {
    const element = document.elementFromPoint(clientX, clientY);
    // Check if the element is a cell or is inside a cell
    const cell = element.classList.contains('cell') ? element : element.closest('.cell');
    if (cell && cell !== lastActivatedCell) {
      playNote(cell.dataset.ratio, cell, cell.dataset.lower === 'true');
      lastActivatedCell = cell;
    }
  }
}

function handlePointerEnd() {
  isMouseDown = false;
  lastActivatedCell = null;
  hasTriggeredOnMouseDown = false;
}

// Mouse events
document.addEventListener('mousedown', (e) => {
  handlePointerStart(e.clientX, e.clientY);
  e.preventDefault(); // Prevent default click behavior
});

document.addEventListener('mousemove', (e) => {
  handlePointerMove(e.clientX, e.clientY);
});

document.addEventListener('mouseup', (e) => {
  handlePointerEnd();
  e.preventDefault(); // Prevent default click behavior
});

// Prevent any residual click events on cells
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('cell') || e.target.parentElement?.classList.contains('cell')) {
    e.preventDefault();
    e.stopPropagation();
  }
});

// Touch events
document.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  handlePointerStart(touch.clientX, touch.clientY);
});

document.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  handlePointerMove(touch.clientX, touch.clientY);
});

document.addEventListener('touchend', () => {
  handlePointerEnd();
});
