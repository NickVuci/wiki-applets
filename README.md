# Microphone Pitch Tracker

A minimal browser app that listens to a microphone and displays the detected monophonic pitch in Hz in real time.

This is an MVP for a future microtonal ear-training app. It intentionally does not include note names, cents deviation, tuning systems, games, accounts, recording, or polyphonic chord detection.

## Run Locally

Microphone access requires a secure browser context. Use `localhost` or an HTTPS-hosted page.

### Option A: Python local server

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option B: VS Code Live Server

Use the Live Server extension and open `index.html`.

## How It Works

The app requests microphone permission only after the `Start Microphone` button is clicked. It captures microphone audio with the Web Audio API, reads time-domain samples from an `AnalyserNode`, and passes those samples to Pitchy for pitch detection.

The microphone is not connected to the audio output, so the app does not echo your microphone through your speakers.

## Browser Notes

The app is intended for modern browsers with support for:

- ES modules
- `navigator.mediaDevices.getUserMedia`
- `AudioContext`
- `AnalyserNode.getFloatTimeDomainData`
- `requestAnimationFrame`

The Pitchy detector is imported from a CDN, so the browser needs network access when loading the page.

## MVP Limitations

- Detects one pitch at a time only.
- Chords and polyphonic instruments are not supported.
- Speech may jump around because speech is not always a stable sustained pitch.
- Very noisy rooms may reduce detector clarity.
- The displayed range is limited to 50 Hz through 2000 Hz.
- Microphone permission can be denied by the browser, the operating system, or insecure page hosting.
