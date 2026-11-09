import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Mic,
  Award,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { PitchTracker, evaluatePitchAccuracy } from '../lib/pitchTracker';
import { ROOT_MIDI_MAP } from '../lib/vocalMelody';
import { savePracticeSession } from '../lib/storage/practiceDb';

const DRILL_TYPES = [
  {
    id: 'five-tone',
    name: '5-Tone Scale',
    description: 'Do-Re-Mi-Fa-Sol-Fa-Mi-Re-Do. Essential for vocal cord warm-up.',
    intervals: [0, 2, 4, 5, 7, 5, 4, 2, 0],
    syllables: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'Fa', 'Mi', 'Re', 'Do'],
  },
  {
    id: 'arpeggio',
    name: 'Octave Arpeggio',
    description: 'Do-Mi-Sol-Do\'-Sol-Mi-Do. Stretches vocal range across registers.',
    intervals: [0, 4, 7, 12, 7, 4, 0],
    syllables: ['Do', 'Mi', 'Sol', 'Do\'', 'Sol', 'Mi', 'Do'],
  },
  {
    id: 'siren',
    name: 'Siren Slide',
    description: 'Smooth glissando upward and back down. Smooths vocal breaks.',
    intervals: [0, 3, 7, 10, 12, 10, 7, 3, 0],
    syllables: ['Oo', 'Oo', 'Oo', 'Ah', 'Ah', 'Ah', 'Oo', 'Oo', 'Mm'],
  },
  {
    id: 'pentatonic',
    name: 'Pentatonic Agility',
    description: 'Fast interval agility run across five scale degrees.',
    intervals: [0, 2, 4, 7, 9, 7, 4, 2, 0],
    syllables: ['La', 'La', 'La', 'La', 'La', 'La', 'La', 'La', 'La'],
  },
];

export default function VocalWarmups({ onClose }) {
  const [selectedDrill, setSelectedDrill] = useState(DRILL_TYPES[0]);
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userPitch, setUserPitch] = useState(null);
  const [hitScore, setHitScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  const trackerRef = useRef(null);
  const audioContextRef = useRef(null);
  const stepTimerRef = useRef(null);
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const rootMidi = ROOT_MIDI_MAP[selectedRoot] || 60;
  const currentTargetMidi = rootMidi + (selectedDrill.intervals[currentStep] || 0);

  // Play a soft reference pitch using Web Audio Oscillator
  const playReferenceTone = useCallback((midi) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      osc.type = 'triangle'; // Warm, flute-like tone
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.75);
    } catch {
      /* ignore */
    }
  }, []);

  // Step advancement timer
  const advanceStep = useCallback(() => {
    if (!isRunningRef.current) return;
    setCurrentStep((prev) => {
      const next = (prev + 1) % selectedDrill.intervals.length;
      const target = rootMidi + selectedDrill.intervals[next];
      playReferenceTone(target);
      return next;
    });
  }, [playReferenceTone, rootMidi, selectedDrill]);

  // Start Drill
  const startDrill = async () => {
    setIsRunning(true);
    setHitScore(0);
    setTotalAttempts(0);
    setCurrentStep(0);

    playReferenceTone(rootMidi + selectedDrill.intervals[0]);

    // Start pitch tracking
    try {
      const tracker = new PitchTracker({
        onPitch: (details) => {
          if (!isRunningRef.current) return;
          setUserPitch(details);

          if (details.midi > 0) {
            const res = evaluatePitchAccuracy(details.midi, currentTargetMidi);
            if (res.rating !== 'miss') {
              setHitScore((s) => s + 1);
            }
            setTotalAttempts((t) => t + 1);
          }
        },
      });
      await tracker.start();
      trackerRef.current = tracker;
    } catch (err) {
      console.warn('[VocalWarmups] Mic start failed:', err);
    }

    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    stepTimerRef.current = setInterval(advanceStep, 1400); // 1.4s per scale note
  };

  const stopDrill = () => {
    setIsRunning(false);
    if (stepTimerRef.current) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    setUserPitch(null);

    // Persist completed drill session to practice database
    if (totalAttempts >= 3) {
      const finalAcc = totalAttempts > 0 ? Math.min(100, Math.round((hitScore / totalAttempts) * 100)) : 0;
      savePracticeSession({
        songTitle: `Warm-Up: ${selectedDrill.name}`,
        artist: `Root ${selectedRoot}`,
        score: finalAcc,
        grade: finalAcc >= 85 ? 'S' : finalAcc >= 75 ? 'A' : finalAcc >= 65 ? 'B' : 'C',
        pitchAccuracy: finalAcc,
        maxStreak: hitScore,
        exerciseType: 'warmup',
        drillId: selectedDrill.id,
        drillName: selectedDrill.name,
        rootKey: selectedRoot,
        durationSeconds: Math.round(totalAttempts * 1.4),
        validSampleRatio: 0.95,
      }).catch(() => {});
    }
  };

  useEffect(() => {
    return () => {
      stopDrill();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const accuracyPct = totalAttempts > 0 ? Math.min(100, Math.round((hitScore / totalAttempts) * 100)) : 0;

  return (
    <div className="vocal-warmups-container" data-lenis-prevent>
      <div className="warmups-header">
        <div className="warmups-title-block">
          <Sparkles size={20} className="warmups-icon-glow" />
          <div>
            <h3 className="warmups-title">Vocal Warm-Ups & Scale Gym</h3>
            <span className="warmups-subtitle">
              Prime your vocal cords, calibrate breath support, and train pitch agility before full performance.
            </span>
          </div>
        </div>
      </div>

      {/* Drill Selector Cards */}
      <div className="warmups-drills-grid">
        {DRILL_TYPES.map((d) => (
          <button
            key={d.id}
            className={`drill-card ${selectedDrill.id === d.id ? 'is-selected' : ''}`}
            onClick={() => {
              if (isRunning) stopDrill();
              setSelectedDrill(d);
              setCurrentStep(0);
            }}
          >
            <div className="drill-card-top">
              <Zap size={14} />
              <span className="drill-name">{d.name}</span>
            </div>
            <p className="drill-desc">{d.description}</p>
          </button>
        ))}
      </div>

      {/* Active Drill Interactive Stage */}
      <div className="warmups-stage">
        <div className="stage-controls-bar">
          <div className="root-key-picker">
            <span className="picker-label">Root Key:</span>
            {['C', 'D', 'E', 'F', 'G', 'A', 'Bb'].map((k) => (
              <button
                key={k}
                className={`key-chip ${selectedRoot === k ? 'is-active' : ''}`}
                onClick={() => {
                  if (isRunning) stopDrill();
                  setSelectedRoot(k);
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            className={`stage-action-btn ${isRunning ? 'is-stopping' : 'is-starting'}`}
            onClick={isRunning ? stopDrill : startDrill}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            <span>{isRunning ? 'Pause Drill' : 'Start Warm-Up'}</span>
          </button>
        </div>

        {/* Syllable Progression Track */}
        <div className="syllable-track">
          {selectedDrill.syllables.map((syl, idx) => {
            const isCurrent = idx === currentStep;
            return (
              <div
                key={idx}
                className={`syllable-bubble ${isCurrent ? 'is-active-bubble' : ''}`}
              >
                <span className="bubble-note">
                  {syl}
                </span>
                <span className="bubble-midi">
                  {selectedRoot}
                </span>
              </div>
            );
          })}
        </div>

        {/* Real-time Pitch Accuracy Meter */}
        <div className="warmups-meter-panel">
          <div className="meter-left">
            <span className="meter-label">Live Vocal Feedback</span>
            <div className="meter-pitch-display">
              <span className="detected-note">{userPitch ? userPitch.fullName : '–'}</span>
              <span className="target-note">Target: {selectedDrill.syllables[currentStep]}</span>
            </div>
          </div>

          <div className="meter-right">
            <div className="meter-score-badge">
              <Award size={15} />
              <span>{accuracyPct}% Accuracy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

