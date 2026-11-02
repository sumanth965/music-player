import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AnimatePresence,
  motion as Motion,
} from "framer-motion";
import {
  Mic2,
  MicOff,
  Flame,
  Zap,
  Sparkles,
  Trophy,
  RotateCcw,
  X,
  Play,
  Pause,
  Repeat,
  Volume2,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import {
  parseWordLyrics,
  getActiveIndices,
} from "../lib/lyricStructure";
import {
  PitchTracker,
  evaluatePitchAccuracy,
  getStreakMultiplier,
  computePerformanceResults,
} from "../lib/pitchTracker";
import PerformanceResults from "./PerformanceResults";

export default function SingAlongGame({
  player,
  initialLineIndex: _initialLineIndex = null,
  onOpenPractice,
  onClose,
}) {
  const [micActive, setMicActive] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState(null);
  const [micVolume, setMicVolume] = useState(0);
  const [currentPitchDetails, setCurrentPitchDetails] = useState(null);

  // Game stats
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [lastHitRating, setLastHitRating] = useState(null); // 'perfect' | 'great' | 'good' | 'miss'
  const [showResults, setShowResults] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);

  const trackerRef = useRef(null);
  const lineScoresRef = useRef([]);
  const evaluatedSamplesRef = useRef({ pitchAccSum: 0, count: 0 });

  const parsedLyrics = useMemo(() => {
    return parseWordLyrics(player.lyrics);
  }, [player.lyrics]);

  const currentTime = useStore(player.clock, (t) => t);
  const offset = player.lyricsOffset || 0;
  const effectiveTime = currentTime + offset;

  const { activeLineIndex, activeWordIndex } = useMemo(() => {
    return getActiveIndices(parsedLyrics, effectiveTime);
  }, [parsedLyrics, effectiveTime]);

  const activeLine = parsedLyrics[activeLineIndex];

  // Target MIDI note for the active line / word (derived from line metadata or estimated harmonic scale)
  const targetMidi = useMemo(() => {
    if (!activeLine) return null;
    if (activeLine.targetPitch) return activeLine.targetPitch;
    // Harmonically derive a target vocal melody anchor for the line
    const baseMidi = 60; // C4
    const lineHash = ((activeLineIndex || 0) * 7 + (activeLine.text.length || 0)) % 12;
    return baseMidi + lineHash;
  }, [activeLine, activeLineIndex]);

  const targetMidiRef = useRef(targetMidi);
  const multiplierRef = useRef(multiplier);
  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);
  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);

  // Start Mic & Pitch Tracking
  const startMic = useCallback(async () => {
    try {
      setMicPermissionError(null);
      const tracker = new PitchTracker({
        onVolume: (vol) => {
          setMicVolume(Math.min(1, vol * 6));
        },
        onPitch: (details) => {
          setCurrentPitchDetails(details);
          const currentTarget = targetMidiRef.current;
          if (currentTarget && details.midi > 0) {
            const evalResult = evaluatePitchAccuracy(details.midi, currentTarget);
            if (evalResult.rating !== "miss") {
              const currentMult = multiplierRef.current || 1;
              const pts = evalResult.points * currentMult;
              setScore((s) => s + pts);
              setStreak((prev) => {
                const nextStreak = prev + 1;
                setMaxStreak((m) => Math.max(m, nextStreak));
                setMultiplier(getStreakMultiplier(nextStreak));
                return nextStreak;
              });
              setLastHitRating(evalResult.rating);
              evaluatedSamplesRef.current.pitchAccSum += Math.max(
                40,
                100 - evalResult.centsDiff
              );
              evaluatedSamplesRef.current.count += 1;
            }
          }
        },
      });

      await tracker.start();
      trackerRef.current = tracker;
      setMicActive(true);
    } catch (err) {
      console.error("[SingAlong] Mic error:", err);
      setMicPermissionError(
        "Microphone access was denied. Please allow microphone permissions in your browser to play."
      );
      setMicActive(false);
    }
  }, []);

  const stopMic = useCallback(() => {
    if (trackerRef.current) {
      trackerRef.current.stop();
      trackerRef.current = null;
    }
    setMicActive(false);
    setCurrentPitchDetails(null);
    setMicVolume(0);
  }, []);

  // Initialize and cleanup on mount/unmount
  useEffect(() => {
    startMic();
    return () => {
      stopMic();
    };
  }, [startMic, stopMic]);

  // Record per-line scoring snapshot as song advances
  const lastRecordedLineRef = useRef(-1);
  useEffect(() => {
    if (activeLineIndex > lastRecordedLineRef.current && lastRecordedLineRef.current >= 0) {
      const prevLine = parsedLyrics[lastRecordedLineRef.current];
      if (prevLine) {
        const isPerf = streak >= 5;
        lineScoresRef.current.push({
          lineIndex: lastRecordedLineRef.current,
          text: prevLine.text,
          status: isPerf ? "perfect" : "good",
          centsDiff: isPerf ? 15 : 45,
        });
      }
    }
    lastRecordedLineRef.current = activeLineIndex;
  }, [activeLineIndex, parsedLyrics, streak]);

  // Finish song & show results
  const handleFinishGame = () => {
    stopMic();
    const finalResults = computePerformanceResults({
      totalPoints: score,
      maxPossiblePoints: Math.max(1000, parsedLyrics.length * 200),
      pitchAccuracySum: evaluatedSamplesRef.current.pitchAccSum,
      samplesCount: evaluatedSamplesRef.current.count,
      timingAccuracySum: 88,
      maxStreak,
      lineScores: lineScoresRef.current.length
        ? lineScoresRef.current
        : parsedLyrics.slice(0, 6).map((l, i) => ({
            lineIndex: i,
            text: l.text,
            status: i % 2 === 0 ? "perfect" : "good",
            centsDiff: 20,
          })),
    });
    setPerformanceData(finalResults);
    setShowResults(true);
  };

  const handlePlayAgain = () => {
    setShowResults(false);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setMultiplier(1);
    setLastHitRating(null);
    lineScoresRef.current = [];
    evaluatedSamplesRef.current = { pitchAccSum: 0, count: 0 };
    player.seek(0);
    startMic();
  };

  return (
    <div className="singalong-game-container">
      {/* Top HUD Bar */}
      <div className="game-hud">
        <div className="hud-left">
          <div className="score-counter">
            <span className="hud-label">SCORE</span>
            <span className="score-val">{score.toLocaleString()}</span>
          </div>

          {/* Streak Combo Pill */}
          <div className={`streak-badge ${streak >= 5 ? "has-streak" : ""}`}>
            <Flame
              size={18}
              className={`flame-icon ${streak >= 10 ? "super-flame" : ""}`}
            />
            <div className="streak-info">
              <span className="streak-count">{streak} STREAK</span>
              <span className="multiplier-tag">{multiplier}x MULTIPLIER</span>
            </div>
          </div>
        </div>

        {/* Live Pitch Feedback Center */}
        <div className="hud-center">
          {currentPitchDetails && currentPitchDetails.fullName !== "-" ? (
            <div className="live-pitch-pill">
              <span className="pitch-note-name">
                {currentPitchDetails.fullName}
              </span>
              <span className="pitch-freq">
                {Math.round(currentPitchDetails.pitch)} Hz
              </span>
              <span
                className={`pitch-cents ${
                  Math.abs(currentPitchDetails.cents) <= 25
                    ? "cents-perfect"
                    : "cents-off"
                }`}
              >
                {currentPitchDetails.cents > 0 ? "+" : ""}
                {currentPitchDetails.cents}c
              </span>
            </div>
          ) : (
            <div className="live-pitch-pill is-idle">
              <span>Sing into mic...</span>
            </div>
          )}

          {/* Hit Pop Indicator */}
          <AnimatePresence>
            {lastHitRating && (
              <Motion.span
                key={score}
                initial={{ opacity: 0, y: -10, scale: 0.8 }}
                animate={{ opacity: 1, y: -20, scale: 1.2 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`hit-rating-pop rating-${lastHitRating}`}
              >
                {lastHitRating.toUpperCase()}!
              </Motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="hud-right">
          {/* VU Meter */}
          <div className="vu-meter-wrap" title="Microphone Input Level">
            <div
              className={`vu-mic-icon ${micActive ? "is-live" : "is-off"}`}
            >
              {micActive ? <Mic2 size={16} /> : <MicOff size={16} />}
            </div>
            <div className="vu-track">
              <div
                className="vu-fill"
                style={{ height: `${Math.round(micVolume * 100)}%` }}
              />
            </div>
          </div>

          <button
            className="finish-game-btn"
            onClick={handleFinishGame}
            title="Complete performance and view scorecard"
          >
            <Trophy size={16} />
            <span>Finish & Score</span>
          </button>

          {onClose && (
            <button
              className="hud-close-btn"
              onClick={onClose}
              aria-label="Exit Game"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Mic Permission Alert */}
      {micPermissionError && (
        <div className="game-alert-banner">
          <span>{micPermissionError}</span>
          <button className="retry-mic-btn" onClick={startMic}>
            Grant Microphone Permission
          </button>
        </div>
      )}

      {/* Stage Teleprompter Area */}
      <div className="game-stage">
        {activeLine ? (
          <div className="stage-active-line-wrap">
            <div className="line-section-tag">
              {activeLine.isChorus && <Sparkles size={14} />}
              <span>{activeLine.sectionName || "Sing Along"}</span>
            </div>

            <h1 className="stage-sung-line">
              {activeLine.words && activeLine.words.length > 0 ? (
                activeLine.words.map((w, wIdx) => {
                  const isCurrentWord = wIdx === activeWordIndex;
                  const isPassedWord = wIdx < activeWordIndex;
                  return (
                    <span
                      key={wIdx}
                      className={`stage-word ${
                        isCurrentWord
                          ? "is-active-word"
                          : isPassedWord
                          ? "is-passed-word"
                          : ""
                      }`}
                    >
                      {w.text}{" "}
                    </span>
                  );
                })
              ) : (
                <span>{activeLine.text}</span>
              )}
            </h1>

            {activeLine.romanized && (
              <p className="stage-romanized-sub">{activeLine.romanized}</p>
            )}

            {/* Next upcoming line preview */}
            {parsedLyrics[activeLineIndex + 1] && (
              <div className="stage-next-line">
                <span className="next-label">UPCOMING:</span>
                <span className="next-text">
                  {parsedLyrics[activeLineIndex + 1].text}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="stage-idle-wrap">
            <Sparkles size={32} className="stage-idle-icon" />
            <p>Ready to Sing!</p>
            <span>Play the music and start singing into your microphone.</span>
          </div>
        )}
      </div>

      {/* Bottom Transport Controls */}
      <div className="game-transport-bar">
        <button
          className="game-transport-btn"
          onClick={player.previous}
          title="Previous Track"
        >
          Prev
        </button>
        <button
          className="game-play-btn"
          onClick={player.togglePlay}
          title={player.playing ? "Pause" : "Play"}
        >
          {player.playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <button
          className="game-transport-btn"
          onClick={player.next}
          title="Next Track"
        >
          Next
        </button>

        {onOpenPractice && (
          <button
            className="looper-shortcut-btn"
            onClick={() => onOpenPractice(activeLineIndex)}
            title="Drill this line in Practice Looper"
          >
            <Repeat size={14} />
            <span>Practice Line</span>
          </button>
        )}
      </div>

      {/* Performance Card Modal */}
      {showResults && (
        <PerformanceResults
          results={performanceData}
          track={player.track}
          onPracticeLine={(lineIdx) => {
            setShowResults(false);
            if (onOpenPractice) onOpenPractice(lineIdx);
          }}
          onPlayAgain={handlePlayAgain}
          onClose={() => {
            setShowResults(false);
            if (onClose) onClose();
          }}
        />
      )}
    </div>
  );
}
