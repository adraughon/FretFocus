# 🎯 FretFocus

An interactive guitar fretboard visualization tool with audio playback. Play scales, chords, and tabs with real-time sound feedback.

**🌐 Live Demo:** [https://adraughon.github.io/FretFocus/](https://adraughon.github.io/FretFocus/)

![FretFocus Screenshot](./assets/screenshot.png?v=2)

## Features

- **Interactive Fretboard** - Click any fret to hear the note played
- **Scale Visualization** - Visualize scales, modes, and pentatonic patterns
- **Chord Context** - See chord voicings in context of the selected key
- **Tab Playback** - Paste guitar tabs and hear them play with synchronized fretboard highlighting
- **Real-time Audio** - Uses pitch-shifted samples for accurate note representation across all frets

## Getting Started

### Setup

Install dependencies:
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

### Build

Build for production:
```bash
npm run build
```

## How It Works

FretFocus uses Web Audio API to pitch-shift representative samples from each string, allowing you to hear any note on the fretboard. Each string has a base sample that gets pitch-shifted to match the target note, creating a seamless playing experience.

The fretboard adapts to show scale positions, chord voicings, and tab positions in real-time, making it easy to visualize music theory and practice guitar.

## Tech Stack

- React
- Vite
- Web Audio API
