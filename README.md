# Microphone Pitch Tracker

A minimal browser app that listens to a microphone, displays the detected monophonic pitch in Hz in real time, and can generate a reference tone from the pitch bar.

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

The pitch bar also controls a simple tone generator. Click anywhere on the bar to start a latched tone, then drag along the bar to change pitch smoothly. The generated tone is shown with its own Hz readout and marker. Use the waveform dropdown to choose `sine`, `square`, `sawtooth`, or `triangle`, and use `Stop Tone` to silence the generated tone.

When microphone tracking and the generator are both running, the generated tone keeps playing through the speakers. The analyzer still reads only the microphone input, so the detected Hz readout follows the generated tone only when the microphone physically picks up the speaker output.

The microphone analyzer and tone generator live in separate JavaScript modules. The tone module owns only the speaker output graph, and the microphone module owns only the capture/analyzer graph. The app UI coordinates them without sharing audio nodes.

If a system mutes browser audio while microphone capture is active, switch the `Source` control to `Internal tone`. Internal mode does not request microphone permission. It treats the generated tone as the analysis source so the detected Hz display can still follow the tone reliably.

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
- If microphone tracking and the tone generator run at the same time, the detector may show the generated tone if the microphone can hear the speakers or headphones clearly enough.
- Internal tone mode is a fallback for audio-policy issues. It verifies the generated tone path, not the physical speaker-to-microphone acoustic path.
