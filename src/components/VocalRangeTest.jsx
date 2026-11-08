import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Award,
  RotateCcw,
  Sparkles,
  ChevronRight,
  CheckCircle,
  Activity,
} from 'lucide-react';
import { PitchTracker } from '../lib/pitchTracker';

const CLASSIFICATIONS = [
  { name: 'Bass', range: 'E2 – E4', min: 40, max: 64, desc: 'Deep, resonant, warm low frequencies.' },
  { name: 'Baritone', range: 'A2 – A4', min: 45, max: 69, desc: 'Most common male voice; rich mid and low warmth.' },
  { name: 'Tenor', range: 'C3 – C5', min: 48, max: 72, desc: 'Bright, piercing, high male register.' },
  { name: 'Contralto', range: 'F3 – F5', min: 53, max: 77, desc: 'Deepest female voice; rare and warm.' },
  { name: 'Mezzo-Soprano', range: 'A3 – A5', min: 57, max: 81, desc: 'Full, flexible female voice spanning mid and high.' },
  { name: 'Soprano', range: 'C4 – C6', min: 60, max: 84, desc: 'Highest female vocal range; bright and agile.' },
];

export default function VocalRangeTest({ onClose }) {
  const [step, setStep] = useState('intro'); // 'intro' | 'lowest' | 'highest' | 'complete'
  const [lowestNote, setLowestNote] = useState(null);
  const [highestNote, setHighestNote] = useState(null);
  const [livePitch, setLivePitch] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const trackerRef = useRef(null);
  const candidateMinRef = useRef(999);
  const candidateMaxRef = useRef(0);

  const startListening = async (mode) => {
    setIsListening(true);
    setLivePitch(null);

    try {
      const tracker = new PitchTracker({
        onPitch: (details) => {
          if (!details || details.midi <= 0) return;
          setLivePitch(details);

          if (details.clarity > 0.8) {
            if (mode === 'lowest') {
              if (details.midi < candidateMinRef.current && details.midi >= 36) { // >= C2
                candidateMinRef.current = details.midi;
                setLowestNote(details);
              }
            } else if (mode === 'highest') {
              if (details.midi > candidateMaxRef.current && details.midi <= 90) { // <= F#6
                candidateMaxRef.current = details.midi;
                setHighestNote(details);
              }
            }
          }
        },
      });

      await tracker.start();
      trackerRef.current = tracker;
    } catch (err) {
      console.warn('[VocalRangeTest] Mic start failed:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    setIsListening(false);
    setLivePitch(null);
  };

  const handleNextFromLowest = () => {
    stopListening();
    if (!lowestNote) {
      setLowestNote({ fullName: 'C3', midi: 48 });
    }
    setStep('highest');
  };

  const handleFinishHighest = () => {
    stopListening();
    if (!highestNote) {
      setHighestNote({ fullName: 'G4', midi: 67 });
    }

    const minM = lowestNote ? lowestNote.midi : 48;
    const maxM = highestNote ? highestNote.midi : 67;

    // Determine voice type
    const midPoint = (minM + maxM) / 2;
    let bestMatch = CLASSIFICATIONS[1]; // default Baritone
    let minDiff = 999;
    for (const c of CLASSIFICATIONS) {
      const cMid = (c.min + c.max) / 2;
      const diff = Math.abs(midPoint - cMid);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = c;
      }
    }

    const profile = {
      minNote: lowestNote ? lowestNote.fullName : 'C3',
      maxNote: highestNote ? highestNote.fullName : 'G4',
      minMidi: minM,
      maxMidi: maxM,
      semitones: Math.max(0, maxM - minM),
      classification: bestMatch.name,
      testedDate: new Date().toISOString(),
    };

    try {
      localStorage.setItem('swar_vocal_range', JSON.stringify(profile));
    } catch {}

    setStep('complete');
  };

  useEffect(() => {
    return () => stopListening();
  }, []);

  const minM = lowestNote ? lowestNote.midi : 48;
  const maxM = highestNote ? highestNote.midi : 67;
  const semitones = Math.max(1, maxM - minM);
  const octaves = (semitones / 12).toFixed(1);

  return (
    <div className="vocal-range-container">
      <div className="range-header">
        <Sparkles size={20} className="range-icon-pulse" />
        <div>
          <h3 className="range-title">Vocal Range & Tessitura Finder</h3>
          <span className="range-subtitle">
            Discover your vocal classification (Bass to Soprano) and find songs tailored to your register.
          </span>
        </div>
      </div>

      {step === 'intro' && (
        <div className="range-card range-intro-card">
          <div className="range-intro-badge">2-Step Voice Assessment</div>
          <p className="range-intro-text">
            We will guide you through singing your lowest comfortable note, then your highest note.
            No singing experience required!
          </p>
          <button
            className="range-primary-btn"
            onClick={() => {
              setStep('lowest');
              startListening('lowest');
            }}
          >
            <span>Begin Range Test</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {step === 'lowest' && (
        <div className="range-card range-active-card">
          <span className="step-tag">Step 1 of 2: Lowest Pitch</span>
          <h4 className="step-prompt">Hum or sing down to your lowest comfortable note</h4>
          <p className="step-guide">
            Make a gentle "mmm" or "aah" sound at the bottom of your speaking range and hold it steady.
          </p>

          <div className="live-pitch-circle">
            <span className="live-note-name">{livePitch ? livePitch.fullName : '–'}</span>
            <span className="live-note-freq">
              {livePitch && livePitch.pitch ? `${Math.round(livePitch.pitch)} Hz` : 'Listening...'}
            </span>
          </div>

          <div className="candidate-box">
            <span>Captured Lowest Note:</span>
            <strong>{lowestNote ? `${lowestNote.fullName} (${Math.round(lowestNote.pitch)} Hz)` : 'Sing to detect'}</strong>
          </div>

          <div className="step-actions">
            <button
              className="range-primary-btn"
              onClick={handleNextFromLowest}
              disabled={!lowestNote}
            >
              <span>Confirm Lowest Note</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 'highest' && (
        <div className="range-card range-active-card">
          <span className="step-tag">Step 2 of 2: Highest Pitch</span>
          <h4 className="step-prompt">Sing up to your highest comfortable note</h4>
          <p className="step-guide">
            Slide gently up to a clear, unstrained high note and sustain for a moment.
          </p>

          <div className="live-pitch-circle is-high">
            <span className="live-note-name">{livePitch ? livePitch.fullName : '–'}</span>
            <span className="live-note-freq">
              {livePitch && livePitch.pitch ? `${Math.round(livePitch.pitch)} Hz` : 'Listening...'}
            </span>
          </div>

          <div className="candidate-box">
            <span>Captured Highest Note:</span>
            <strong>{highestNote ? `${highestNote.fullName} (${Math.round(highestNote.pitch)} Hz)` : 'Sing to detect'}</strong>
          </div>

          <div className="step-actions">
            {!isListening && (
              <button
                className="range-secondary-btn"
                onClick={() => startListening('highest')}
              >
                <RotateCcw size={15} />
                <span>Restart Mic</span>
              </button>
            )}
            <button
              className="range-primary-btn"
              onClick={handleFinishHighest}
              disabled={!highestNote}
            >
              <CheckCircle size={16} />
              <span>Complete Assessment</span>
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="range-card range-results-card">
          <div className="results-badge">
            <Award size={18} />
            <span>Voice Profile Calibrated</span>
          </div>

          <div className="range-span-row">
            <div className="span-box">
              <span className="span-label">Lowest Note</span>
              <strong className="span-val">{lowestNote?.fullName || 'C3'}</strong>
            </div>
            <div className="span-divider">
              <span className="semitones-tag">{semitones} Semitones</span>
              <span className="octaves-tag">{octaves} Octaves</span>
            </div>
            <div className="span-box">
              <span className="span-label">Highest Note</span>
              <strong className="span-val">{highestNote?.fullName || 'G4'}</strong>
            </div>
          </div>

          <div className="classification-pill">
            <Activity size={16} />
            <span>Voice Category: <strong>{CLASSIFICATIONS[1].name}</strong> ({CLASSIFICATIONS[1].range})</span>
          </div>

          <p className="results-advice">
            Your profile has been saved. Songs and practice exercises in SWAR will now tailor target pitches to your optimal vocal register.
          </p>

          <button
            className="range-secondary-btn"
            onClick={() => {
              setLowestNote(null);
              setHighestNote(null);
              candidateMinRef.current = 999;
              candidateMaxRef.current = 0;
              setStep('intro');
            }}
          >
            <RotateCcw size={15} />
            <span>Retake Test</span>
          </button>
        </div>
      )}
    </div>
  );
}

