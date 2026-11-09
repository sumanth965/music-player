# 🎵 SWAR — Smart Music Player & AI Singing Practice Assistant

> **A luxury, privacy-first web music player and AI-powered vocal studio.**  
> Artwork-led interface, universal multi-catalog search, synchronized word-by-word lyrics, seamless DJ transitions, local high-fidelity audio playback, and an intelligent vocal training suite. **No account or login required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.2.4-61DAFB.svg?logo=react)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tests: 241 Passing](https://img.shields.io/badge/Tests-241%20Passed-brightgreen.svg)](#testing)
[![Lenis Smooth Scroll](https://img.shields.io/badge/Lenis-Smooth%20Scroll-black.svg)](https://lenis.darkroom.engineering/)

[Feature Reference](docs/FEATURES.md) • [Architecture Guide](docs/ARCHITECTURE.md) • [DJ Transitions](docs/DJ-TRANSITION.md) • [Live Tests](docs/LIVE-TESTS.md)

---

## 📑 Table of Contents

- [Overview & Philosophy](#-overview--philosophy)
- [Key Features](#-key-features)
  - [1. Music Playback & Audio Engine](#1-music-playback--audio-engine)
  - [2. Multi-Catalog Search](#2-multi-catalog-search)
  - [3. Synchronized Word-by-Word Lyrics](#3-synchronized-word-by-word-lyrics)
  - [4. Seamless DJ Transition Engine](#4-seamless-dj-transition-engine)
  - [5. AI Teleprompter & Practice Studio](#5-ai-teleprompter--practice-studio)
  - [6. Adaptive AI Vocal Coach](#6-adaptive-ai-vocal-coach)
  - [7. Smooth Inertia Scrolling (Lenis)](#7-smooth-inertia-scrolling-lenis)
  - [8. Design System & Themes](#8-design-system--themes)
- [Keyboard Shortcuts & Gestures](#-keyboard-shortcuts--gestures)
- [Architecture & Project Structure](#-architecture--project-structure)
- [API Reference](#-api-reference)
- [Getting Started](#-getting-started)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Author & License](#-author--license)

---

## 🌟 Overview & Philosophy

**SWAR** is designed from the ground up to restore elegance, intimacy, and acoustic integrity to personal music listening and vocal training:

- **100% Privacy-First & Local-First**: Favorites, listening history, audio preferences, and vocal practice journals stay stored securely in your browser's IndexedDB and `localStorage`. No tracking, no user profiles, and no behavioral telemetry.
- **Direct Hi-Fi Audio**: Device music files (FLAC, ALAC, WAV, AAC, MP3, OGG) are decoded in-browser using the Web Audio API without uploading a single byte to external servers. Supports hi-res formats up to 24-bit / 96 kHz and 5.1 / 7.1 multichannel surround.
- **Universal Streaming**: Seamlessly streams online music, official uploads, live recordings, and curated playlists with synchronized metadata and lyric matching.
- **Integrated Vocal Intelligence**: A singing studio equipped with real-time autocorrelation pitch tracking, interactive scale gyms, custom pitch drills, vocal range detection, take recording, and adaptive AI coaching.

---

## 🎧 Key Features

### 1. Music Playback & Audio Engine
- **Hybrid Streaming & Local Playback**: Streams online tracks via YouTube IFrame integration while natively processing local device audio with zero latency.
- **Hi-Res Format Inspector**: Real-time signal path inspector showing active sample rates (e.g. 44.1 kHz, 48 kHz, 96 kHz), 32-bit floating-point processing, and surround channels.
- **Loudness Normalization**: Custom headroom control supporting *Quiet (Soft)*, *Normal (Balanced)*, and *Loud (Full Dynamic Compression)* modes.
- **Best-Part Detection**: Dynamic detection of musical peaks, hooks, and choruses through audio envelope analysis, phrase recurrence, and YouTube replay markers.
- **Beat Pulse & Audio Reactive Glow**: Live beat tracking that creates subtle rhythmic breathing effects across the artwork and background stage.

### 2. Multi-Catalog Search
- **Intent-Driven Discovery**: Aggregates catalog results from multiple trusted music databases in parallel:
  - **Songs & Albums**: iTunes Search API with high-resolution artwork extraction.
  - **Artists**: Deezer API for artist profiles, genres, and discographies.
  - **Videos, Remixes & Playlists**: YouTube API for live performances, acoustic cuts, and curated tracklists.
- **Instant Search Suggestions & History**: Interactive autocomplete dropdown with keyboard navigation and instant history replay.
- **Mood Discovery**: 10 curated mood seeds (Chill, Sad, Workout, Sleep, Energize, Romance, Feel Good, Party, Commute, Focus) that adapt the radio recommendations dynamically.

### 3. Synchronized Word-by-Word Lyrics
- **Multi-Source Lyric Fetcher**: Simultaneously races BetterLyrics, LyricsPlus, LRCLib, KuGou (KRC word-timed), NetEase Cloud Music, and TTML sources.
- **Word-Level & Syllable Timing**: Real-time karaoke-style word highlighting with smooth scale zoom (3%) and edge-free glowing typography.
- **Backing Vocal Splitting**: Automatically isolates backing vocals in parentheses, keeping them active alongside lead melodies.
- **Manual & Automatic Sync Nudge**: Adjust lyric timing in 0.1-second increments with automatic persistence per track, plus caption agreement auto-alignment.
- **Swar AI Whisper Transcription**: Fallback cloud speech-to-text transcription (`/api/transcribe`) powered by Whisper for untimed or custom uploads.

### 4. Seamless DJ Transition Engine
- **Tempo Matching (BPM Glide)**: Smoothly interpolates the tempo of adjacent songs over 4 to 12 bars without altering vocal pitch.
- **Beat-Phase Alignment**: Calculates beat grids and snaps transition entry points to downbeats or chorus peaks.
- **Bass Swaps & Sub Drops**: Low-frequency resonant crossover filter swaps basslines between tracks, accompanied by an optional synthesized sub-bass sweep.
- **Live DJ Changes**: Pressing Next during playback keeps the current song active while the upcoming track primes, blending them smoothly rather than cutting off abruptly.

### 5. AI Teleprompter & Practice Studio
Access 6 dedicated practice modes designed for vocalists of all skill levels:

1. **Lyrics Teleprompter (`LyricsStudio.jsx`)**: Full-screen teleprompter with auto-scroll, section anchors (Verse, Chorus, Bridge), word sync, and tempo markers.
2. **Vocal Practice & Line Looper (`PracticeMode.jsx`)**: Loop difficult phrases, slow down playback (0.5x – 1.5x), isolate vocal frequencies, and sing along with live mic monitoring.
3. **Sing-Along & Vocal Pitch Game (`SingAlongGame.jsx`)**: Real-time autocorrelation pitch tracking mapping your singing onto target MIDI pitch curves. Tracks pitch accuracy, streaks, combo multipliers, and awards grades (S, A, B, C).
4. **Vocal Warm-Ups & Scale Gym (`VocalWarmups.jsx`)**: Guided vocal exercises including 5-Tone Scale, Octave Arpeggio, Siren Slide, and Pentatonic Agility with customizable root keys (C through Bb) and visual solfege feedback.
5. **Vocal Range & Tessitura Finder (`VocalRangeTest.jsx`)**: Step-by-step interactive pitch assessment identifying lowest note, highest note, semitone width, octave span, and vocal classification (Bass, Baritone, Tenor, Contralto, Mezzo-Soprano, Soprano).
6. **Practice Journal & History (`PracticeJournal.jsx`)**: Tracks daily singing time, pitch accuracy trends, register mastery (Chest, Mixed, Head), and historical practice logs.

### 6. Adaptive AI Vocal Coach
- **Practice Intelligence Dashboard (`AdaptiveCoachDashboard.jsx`)**: Analyzes vocal sessions to identify weak musical intervals and recurring pitch deviations.
- **Adaptive Difficulty Tiers**: Automatically balances challenge levels between *Gentle*, *Standard*, and *Master* based on verified streak performance.
- **Structured Daily Practice Plans**: Generates customized 5-step daily vocal routines targeted at your specific vocal weaknesses.
- **Take Recording & Review (`VocalTakeReview.jsx`)**: Record microphone takes with calibrated latency compensation, play back synchronized takes, and export high-quality recordings.

### 7. Smooth Inertia Scrolling (Lenis)
- **Top-Level Lenis Integration**: Full-app inertia scrolling powered by `@studio-freight/lenis` (`lenis/react`), tuned for natural mouse-wheel and trackpad dynamics (`lerp: 0.1`, `wheelMultiplier: 0.95`).
- **Touch & Accessibility Preservation**: Maintains 120 Hz native mobile touch scrolling and honors `prefers-reduced-motion` settings.
- **Nested Scroller Protection (`data-lenis-prevent`)**: Isolated wheel scrolling on the navigation sidebar, teleprompter lyrics viewport, modal dialog sheets, Practice Studio modules, search suggestions, and YouTube video players.

### 8. Design System & Themes
- **Warm Luxury Palette**: Handcrafted with rich espresso (`#2b1b11`), dark mahogany, ivory parchment (`#faf6f0`), and vibrant golden-orange (`#ea580c`).
- **Theme Modes**: Seamlessly toggle between **Light (Warm Ivory)**, **Dark (Obsidian)**, and **System Auto** with WCAG 2.1 AA compliant text contrast.
- **Dynamic Backdrop Motion**: Plays blurred video backdrops behind song artwork, or displays ambient glowing color fields derived from album covers.

---

## ⌨️ Keyboard Shortcuts & Gestures

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause playback |
| `←` / `→` | Seek backward / forward 5 seconds |
| `Shift` + `←` / `→` | Previous track / Next track |
| `L` | Toggle Lyrics & Teleprompter view |
| `F` | Add / Remove current track from Liked Songs |
| `M` | Mute / Unmute audio |
| `I` | Toggle Lyrics Focus Mode |
| `/` or `Ctrl` + `K` | Focus Search Bar |
| `Esc` | Close active modal, sheet, or overlay |

### Touch Gestures
- **Swipe Cover Left / Right**: Skip to previous or next song.
- **Swipe Cover Down**: Close immersive player to mini-player bar.
- **Swipe Queue Item Left**: Remove track from play queue.

---

## 🏛️ Architecture & Project Structure

```
swar/
├── api/                           # Vercel Serverless API Handlers
│   ├── _lib/                      # Shared API utilities (lyrics, search, cache, SSRF security)
│   ├── album/                     # Album tracklist & metadata resolver
│   ├── artist/                    # Artist discography & top tracks resolver
│   ├── lyrics/                    # Multi-provider lyrics aggregator & sync engine
│   ├── moods/                     # Mood playlist resolver
│   ├── playlist/                  # YouTube & external playlist resolver
│   ├── recommendations/           # Acoustic similarity recommendation engine
│   ├── search/                    # Unified multi-catalog search endpoint
│   ├── tempo/                     # Track BPM and musical grid provider
│   └── transcribe/                # Whisper audio-to-text transcription handler
├── docs/                          # Detailed technical documentation
│   ├── ARCHITECTURE.md            # Deep architecture overview
│   ├── DJ-TRANSITION.md           # DJ glide and tempo-matching engineering spec
│   ├── FEATURES.md                # Comprehensive feature catalog
│   ├── LIVE-TESTS.md              # Real-world verification suites
│   └── PERFORMANCE-AUDIT.md       # Lighthouse and runtime performance audits
├── public/                        # Static assets, PWA manifest, and app icons
├── server/                        # Standalone Node.js backend server (development & self-hosting)
├── shared/                        # Isomorphic utilities (palette, audio-variants, language)
├── src/                           # Client React Application (Vite + React 19)
│   ├── components/                # React UI Components
│   │   ├── AlbumArt/              # Adaptive cover art rendering
│   │   ├── Background/            # Motion and ambient blur canvas
│   │   ├── SearchBar/             # Accessible multi-catalog search bar
│   │   ├── VocalIntelligence/     # AI Vocal Coach dashboard & metrics
│   │   ├── LyricsStudio.jsx       # Synchronized teleprompter stream
│   │   ├── PerformanceResults.jsx # Vocal game scoring cards
│   │   ├── PracticeJournal.jsx    # Session history & progress tracking
│   │   ├── PracticeMode.jsx       # Phrase looper & vocal frequency isolator
│   │   ├── SingAlongGame.jsx      # Real-time pitch tracking game
│   │   ├── SongTextData.jsx       # Song metadata and lyric diagnostics modal
│   │   ├── VocalRangeTest.jsx     # Vocal range and tessitura finder
│   │   ├── VocalTakeReview.jsx    # Audio take recorder & playback
│   │   ├── VocalWarmups.jsx       # Scale gym & solfege exercises
│   │   └── Welcome.jsx            # Handwritten intro splash screen
│   ├── hooks/                     # Custom React Hooks
│   │   ├── useAudioAnalyzer.js    # Web Audio API FFT analyzer
│   │   ├── useNavigation.js       # PushState & history routing
│   │   ├── usePlayer.js           # Core playback state machine & queue manager
│   │   ├── useVocalIntelligence.js# Vocal analysis & adaptive coach hook
│   │   └── useVocalRecording.js   # Latency-compensated mic recording hook
│   ├── lib/                       # Client libraries & mathematical algorithms
│   │   ├── dj.js                  # DJ transition state machine & Web Audio DSP
│   │   ├── pitchTracker.js        # Autocorrelation real-time pitch detection
│   │   ├── pulse.js               # Audio beat detection & pulse timing
│   │   ├── smooth-scroll.js       # Lenis instance orchestration
│   │   ├── vocalMelody.js         # Melodic contour & target MIDI generation
│   │   └── storage/               # IndexedDB vocal practice database
│   ├── App.jsx                    # Root application component & layout shell
│   ├── App.css                    # Unified design tokens, themes, & responsive layouts
│   └── main.jsx                   # React root entrypoint
├── package.json                   # Project manifest & dependency configuration
└── vite.config.js                 # Vite bundler configuration & local API proxy
```

---

## 📡 API Reference

All endpoints are hosted as same-origin endpoints under `/api/*`:

| Endpoint | Method | Description | Parameters |
| :--- | :--- | :--- | :--- |
| `/api/search` | `GET` | Universal search across tracks, albums, artists, videos | `q` (string), `type` (`all`, `song`, `album`, `artist`, `video`, `playlist`) |
| `/api/lyrics` | `GET` | Aggregated synchronized word-level and line-level lyrics | `artist`, `title`, `duration`, `videoId` |
| `/api/tempo` | `GET` | Track BPM, musical key, and beat phase grid | `artist`, `title` |
| `/api/recommendations` | `GET` | Account-free acoustic similarity recommendations | `seed`, `artist`, `genre`, `language` |
| `/api/artist` | `GET` | Artist discography, biography, and top tracks | `name` or `id` |
| `/api/album` | `GET` | Album tracklist, release year, and high-res cover | `id` or `name` |
| `/api/playlist` | `GET` | External playlist track items | `id` |
| `/api/moods` | `GET` | Mood-specific playlist collections | `mood` (`chill`, `workout`, `party`, etc.) |
| `/api/transcribe` | `POST` | Speech-to-text fallback transcription | Multipart audio file payload |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository**:
   ```sh
   git clone https://github.com/sumanth965/music-player.git
   cd music-player
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Start the development server**:
   ```sh
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

### Production Build

To create an optimized production build:
```sh
npm run build
```
Built client assets will be generated in the `dist/` directory. You can preview the production bundle locally with:
```sh
npm run preview
```

---

## 🧪 Testing & Quality Assurance

SWAR maintains a rigorous, zero-dependency unit test suite using Node's native test runner (`node --test`), verifying audio synchronization, pitch analysis, parsing routines, and security constraints.

Run the full test suite:
```sh
npm test
```

### Coverage Highlights (241 Tests)
- **Audio & DJ Transitions**: Beat matching, pitch preservation, tempo ramp interpolation, and loudness balance.
- **Lyrics Parsers**: KRC decryption, TTML parser, LRC timestamp boundaries, and backing vocal separation.
- **Pitch Detection & Vocal Intelligence**: Autocorrelation accuracy, cents deviation, streak multipliers, register classifications, and adaptive recommendations.
- **Security & Validation**: SSRF URL validation, query bound enforcement, safe file parsing, and memory leak prevention.

---

## 👨‍💻 Author & Maintainer

- **Developer**: Sumanth Poojary
- **GitHub**: [@sumanth965](https://github.com/sumanth965)
- **Email**: [sumanthpoojary965@gmail.com](mailto:sumanthpoojary965@gmail.com)
- **Repository**: [https://github.com/sumanth965/music-player](https://github.com/sumanth965/music-player)

---

## ⚖️ License & Disclaimer

- **License**: Released under the [MIT License](LICENSE). Third-party dependencies retain their respective licenses.
- **Disclaimer**: Music, album artwork, lyrics, and videos are the property of their respective copyright holders. Online streaming availability and sound quality are subject to third-party streaming services. SWAR hosts no copyrighted audio files.
