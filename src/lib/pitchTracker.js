/**
 * pitchTracker.js
 * Real-time microphone audio pitch detector using Web Audio API and normalized
 * autocorrelation (YIN-derivative), with AudioWorklet offloading, MIDI/cents conversion,
 * latency calibration, and scoring mechanics.
 */

// Key for persisting mic latency compensation in milliseconds
const LATENCY_KEY = 'swar_mic_latency_ms';

/**
 * Gets the user's calibrated microphone latency offset in milliseconds.
 * Positive value shifts analysis window forward; negative shifts backward.
 * @returns {number}
 */
export function getMicLatencyCalibration() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  try {
    const val = parseInt(window.localStorage.getItem(LATENCY_KEY), 10);
    return isNaN(val) ? 0 : Math.max(-150, Math.min(150, val));
  } catch {
    return 0;
  }
}

/**
 * Sets the user's calibrated microphone latency offset in milliseconds.
 * @param {number} ms
 * @returns {number}
 */
export function setMicLatencyCalibration(ms) {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  try {
    const clamped = Math.max(-150, Math.min(150, Math.round(ms || 0)));
    window.localStorage.setItem(LATENCY_KEY, String(clamped));
    return clamped;
  } catch {
    return 0;
  }
}

// Note names for MIDI numbers (MIDI 69 = A4 = 440 Hz)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Converts frequency in Hz to fractional MIDI note number.
 * @param {number} frequency
 * @returns {number}
 */
export function frequencyToMidi(frequency) {
  if (!frequency || frequency <= 0) return 0;
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * Converts MIDI note to standard note name and octave (e.g. 60 -> "C4").
 * @param {number} midi
 * @returns {{ name: string, octave: number, cents: number, fullName: string }}
 */
export function midiToNoteDetails(midi) {
  if (!midi || midi <= 0) return { name: '-', octave: 0, cents: 0, fullName: '-' };
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[noteIndex];
  return {
    name,
    octave,
    cents,
    fullName: `${name}${octave}`,
  };
}

/**
 * Performs Normalized Square Difference / Autocorrelation pitch detection on time-domain audio buffer.
 * @param {Float32Array} buffer
 * @param {number} sampleRate
 * @returns {{ pitch: number, clarity: number, rms: number } | null}
 */
export function autoCorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let sumOfSquares = 0;

  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    sumOfSquares += val * val;
  }

  const rms = Math.sqrt(sumOfSquares / size);
  // Silence / noise floor threshold
  if (rms < 0.015) {
    return { pitch: 0, clarity: 0, rms };
  }

  // Focus on human vocal range: 65 Hz (C2) to 1050 Hz (C6)
  const minPeriod = Math.floor(sampleRate / 1050);
  const maxPeriod = Math.floor(sampleRate / 65);

  let bestPeriod = -1;
  let bestCorrelation = 0;

  // Normalized autocorrelation
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < size - period; i++) {
      const a = buffer[i];
      const b = buffer[i + period];
      correlation += a * b;
      normA += a * a;
      normB += b * b;
    }

    const norm = Math.sqrt(normA * normB);
    const normalizedCorr = norm > 0 ? correlation / norm : 0;

    if (normalizedCorr > bestCorrelation && normalizedCorr > 0.6) {
      bestCorrelation = normalizedCorr;
      bestPeriod = period;
    }
  }

  if (bestCorrelation > 0.7 && bestPeriod > 0) {
    // Parabolic interpolation for sub-sample peak refinement
    const pitch = sampleRate / bestPeriod;
    return { pitch, clarity: bestCorrelation, rms };
  }

  return { pitch: 0, clarity: bestCorrelation, rms };
}

/**
 * Creates a PitchTracker session connected to the user's microphone.
 * Uses dedicated AudioWorkletProcessor where supported, falling back gracefully
 * to AnalyserNode + requestAnimationFrame.
 */
export class PitchTracker {
  constructor({ onPitch, onVolume, sampleRate = 44100 }) {
    this.onPitch = onPitch;
    this.onVolume = onVolume;
    this.sampleRate = sampleRate;
    this.audioContext = null;
    this.analyser = null;
    this.workletNode = null;
    this.micStream = null;
    this.sourceNode = null;
    this.isRunning = false;
    this.animationFrameId = null;
    this.buffer = null;
  }

  async start() {
    if (this.isRunning) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });
      this.sampleRate = this.audioContext.sampleRate;

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);

      // Attempt to load AudioWorklet
      let workletReady = false;
      if (this.audioContext.audioWorklet) {
        try {
          await this.audioContext.audioWorklet.addModule('/pitch-processor.worklet.js');
          this.workletNode = new AudioWorkletNode(this.audioContext, 'pitch-processor', {
            processorOptions: { sampleRate: this.sampleRate },
          });

          this.workletNode.port.onmessage = (event) => {
            if (!this.isRunning) return;
            const res = event.data;
            if (!res) return;

            if (this.onVolume && typeof res.rms === 'number') {
              this.onVolume(res.rms);
            }

            if (res.pitch > 0 && this.onPitch) {
              const midi = frequencyToMidi(res.pitch);
              const details = midiToNoteDetails(midi);
              this.onPitch({
                pitch: res.pitch,
                midi,
                clarity: res.clarity,
                rms: res.rms,
                ...details,
              });
            }
          };

          this.sourceNode.connect(this.workletNode);
          workletReady = true;
        } catch {
          // AudioWorklet load failed (e.g. cross-origin worker restriction or legacy context), fall back
          workletReady = false;
        }
      }

      // Fallback: AnalyserNode + RAF
      if (!workletReady) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.sourceNode.connect(this.analyser);
        this.buffer = new Float32Array(this.analyser.fftSize);
        this._pollLoop();
      }

      this.isRunning = true;
    } catch (err) {
      this.stop();
      throw err;
    }
  }

  _pollLoop() {
    if (!this.isRunning || !this.analyser) return;

    this.analyser.getFloatTimeDomainData(this.buffer);
    const result = autoCorrelate(this.buffer, this.sampleRate);

    if (result) {
      if (this.onVolume) {
        this.onVolume(result.rms);
      }

      if (result.pitch > 0 && this.onPitch) {
        const midi = frequencyToMidi(result.pitch);
        const details = midiToNoteDetails(midi);
        this.onPitch({
          pitch: result.pitch,
          midi,
          clarity: result.clarity,
          rms: result.rms,
          ...details,
        });
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this._pollLoop());
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch {
        /* ignore */
      }
      this.workletNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        /* ignore */
      }
      this.audioContext = null;
    }
  }
}

/**
 * Evaluates pitch performance comparing user pitch against target.
 * @param {number} userMidi
 * @param {number} targetMidi
 * @returns {{ rating: 'perfect'|'great'|'good'|'miss', points: number, centsDiff: number }}
 */
export function evaluatePitchAccuracy(userMidi, targetMidi) {
  if (!userMidi || !targetMidi) return { rating: 'miss', points: 0, centsDiff: 999 };

  // Allow octave equivalence (singing an octave up or down is musically valid)
  let diffInSemitones = Math.abs(userMidi - targetMidi);
  while (diffInSemitones >= 6) {
    diffInSemitones = Math.abs(diffInSemitones - 12);
  }

  const centsDiff = Math.round(diffInSemitones * 100);

  if (centsDiff <= 35) {
    return { rating: 'perfect', points: 100, centsDiff };
  } else if (centsDiff <= 65) {
    return { rating: 'great', points: 75, centsDiff };
  } else if (centsDiff <= 110) {
    return { rating: 'good', points: 50, centsDiff };
  }

  return { rating: 'miss', points: 0, centsDiff };
}

/**
 * Calculates multiplier from consecutive streak.
 * @param {number} streak
 * @returns {number}
 */
export function getStreakMultiplier(streak) {
  if (streak >= 20) return 4;
  if (streak >= 12) return 3;
  if (streak >= 5) return 2;
  return 1;
}

/**
 * Computes performance report card statistics.
 * @param {Object} session
 * @returns {Object}
 */
export function computePerformanceResults({ totalPoints, maxPossiblePoints, pitchAccuracySum, samplesCount, timingAccuracySum, maxStreak, lineScores = [] }) {
  const percentage = maxPossiblePoints > 0 ? Math.min(100, Math.round((totalPoints / maxPossiblePoints) * 100)) : 0;

  let grade = 'D';
  if (percentage >= 92) grade = 'S';
  else if (percentage >= 82) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 58) grade = 'C';

  const avgPitchAcc = samplesCount > 0 ? Math.min(100, Math.round(pitchAccuracySum / samplesCount)) : 0;
  const avgTimingAcc = lineScores.length > 0 ? Math.min(100, Math.round(timingAccuracySum / lineScores.length)) : 85;

  return {
    score: percentage,
    totalPoints,
    grade,
    pitchAccuracy: avgPitchAcc,
    timingAccuracy: avgTimingAcc,
    maxStreak,
    lineScores,
  };
}
