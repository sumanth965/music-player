import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AnimatePresence,
  motion as Motion,
} from "framer-motion";
import {
  Repeat,
  Play,
  Pause,
  Zap,
  Gauge,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Mic2,
  X,
  RotateCcw,
  Plus,
  Minus,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import {
  parseWordLyrics,
  extractSectionChips,
} from "../lib/lyricStructure";

export default function PracticeMode({
  player,
  initialLineIndex = null,
  onOpenSingAlong,
  onClose,
}) {
  const [selectedLineIndex, setSelectedLineIndex] = useState(
    initialLineIndex !== null ? initialLineIndex : 0
  );
  const [loopType, setLoopType] = useState("line"); // 'line' | 'section' | 'custom'
  const [speed, setSpeed] = useState(1.0);
  const [loopActive, setLoopActive] = useState(true);

  const parsedLyrics = useMemo(() => {
    return parseWordLyrics(player.lyrics);
  }, [player.lyrics]);

  // A-B loop boundaries in seconds
  const [loopA, setLoopA] = useState(() => {
    const first = parseWordLyrics(player.lyrics)?.[initialLineIndex ?? 0];
    return first ? parseFloat(Math.max(0, first.time - 0.2).toFixed(2)) : 0;
  });
  const [loopB, setLoopB] = useState(() => {
    const first = parseWordLyrics(player.lyrics)?.[initialLineIndex ?? 0];
    return first ? parseFloat((first.endTime + 0.3).toFixed(2)) : 5;
  });

  const sections = useMemo(() => {
    return extractSectionChips(parsedLyrics);
  }, [parsedLyrics]);

  const currentTime = useStore(player.clock, (t) => t);
  const offset = player.lyricsOffset || 0;
  const effectiveTime = currentTime + offset;

  const handleSelectLine = useCallback((index) => {
    setLoopType("line");
    setSelectedLineIndex(index);
    const line = parsedLyrics[index];
    if (line) {
      const start = Math.max(0, line.time - 0.2);
      const end = line.endTime + 0.3;
      setLoopA(parseFloat(start.toFixed(2)));
      setLoopB(parseFloat(end.toFixed(2)));
      player.seek(start);
    }
  }, [parsedLyrics, player]);

  // Synchronize when initialLineIndex prop changes from outside
  const prevInitialIndexRef = useRef(initialLineIndex);
  useEffect(() => {
    if (initialLineIndex !== null && initialLineIndex !== prevInitialIndexRef.current) {
      prevInitialIndexRef.current = initialLineIndex;
      handleSelectLine(initialLineIndex);
    }
  }, [initialLineIndex, handleSelectLine]);

  // Handle looping logic: when effectiveTime exceeds loopB, jump back to loopA
  useEffect(() => {
    if (!loopActive) return;
    if (loopB > loopA && effectiveTime >= loopB) {
      player.seek(loopA);
    }
  }, [effectiveTime, loopActive, loopA, loopB, player]);

  // Adjust playback speed
  const handleSetSpeed = (newSpeed) => {
    setSpeed(newSpeed);
    if (player.setSpeed) {
      player.setSpeed(newSpeed);
    }
  };

  const handleSelectSection = (sec) => {
    setLoopType("section");
    setLoopA(parseFloat(Math.max(0, sec.time - 0.2).toFixed(2)));
    setLoopB(parseFloat((sec.endTime + 0.3).toFixed(2)));
    if (sec.lineIndices.length > 0) {
      setSelectedLineIndex(sec.lineIndices[0]);
    }
    player.seek(sec.time);
  };

  // Fine tune loop bounds
  const adjustLoopA = (delta) => {
    setLoopA((prev) => Math.max(0, parseFloat((prev + delta).toFixed(2))));
  };

  const adjustLoopB = (delta) => {
    setLoopB((prev) => Math.max(loopA + 0.5, parseFloat((prev + delta).toFixed(2))));
  };

  const currentLine = parsedLyrics[selectedLineIndex];
  const loopDuration = Math.max(0.1, loopB - loopA);
  const loopProgress = Math.min(
    1,
    Math.max(0, (effectiveTime - loopA) / loopDuration)
  );

  return (
    <div className="practice-mode-container">
      {/* Top Header */}
      <div className="practice-header">
        <div className="practice-header-left">
          <Repeat size={20} className="header-icon-spin" />
          <div>
            <h2 className="practice-title">Vocal Practice & Line Looper</h2>
            <span className="practice-subtitle">
              Loop challenging vocal runs, master syllable timing, and drill
              chorus hooks at custom speeds.
            </span>
          </div>
        </div>

        <div className="practice-header-actions">
          {onOpenSingAlong && (
            <button
              className="action-pill-btn vocal-test-pill"
              onClick={() => onOpenSingAlong(selectedLineIndex)}
              title="Test this section in Vocal Pitch Game"
            >
              <Mic2 size={16} />
              <span>Test with Vocal Game</span>
            </button>
          )}

          {onClose && (
            <button
              className="practice-close-btn"
              onClick={onClose}
              aria-label="Close Practice Mode"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Deck */}
      <div className="practice-deck">
        {/* Active Line Hero Display */}
        <div className="practice-focus-card">
          <div className="focus-card-header">
            <span className="card-badge">
              {loopType === "line"
                ? `Line ${selectedLineIndex + 1} of ${parsedLyrics.length}`
                : "Section Loop"}
            </span>

            {currentLine?.isFast && (
              <span className="fast-drill-badge">
                <Zap size={13} /> {currentLine.syllablesPerSec} syl/sec (Fast Drill)
              </span>
            )}

            {currentLine?.isChorus && (
              <span className="chorus-badge">
                <Sparkles size={12} /> Hook / Chorus
              </span>
            )}
          </div>

          <div className="focus-card-lyrics">
            <p className="focus-native-text">
              {currentLine?.text || "Select a line below to begin practice"}
            </p>
            {currentLine?.romanized && (
              <p className="focus-romanized-text">{currentLine.romanized}</p>
            )}
          </div>

          {/* Loop Progress Visualizer Bar */}
          <div className="loop-progress-wrapper">
            <div
              className="loop-progress-fill"
              style={{ width: `${(loopProgress * 100).toFixed(1)}%` }}
            />
            <div className="loop-time-markers">
              <span>A: {loopA.toFixed(1)}s</span>
              <span className="current-pos">
                {effectiveTime.toFixed(1)}s ({((loopProgress) * 100).toFixed(0)}%)
              </span>
              <span>B: {loopB.toFixed(1)}s</span>
            </div>
          </div>

          {/* Looper Transport Controls */}
          <div className="practice-transport">
            <div className="transport-row">
              <button
                className={`loop-toggle-btn ${loopActive ? "is-active" : ""}`}
                onClick={() => setLoopActive(!loopActive)}
                title="Toggle Loop Auto-Repeat"
              >
                <Repeat size={16} />
                <span>{loopActive ? "Looping Active" : "Loop Paused"}</span>
              </button>

              <button
                className="transport-main-btn"
                onClick={player.togglePlay}
                title={player.playing ? "Pause" : "Play"}
              >
                {player.playing ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" />
                )}
              </button>

              <button
                className="restart-loop-btn"
                onClick={() => player.seek(loopA)}
                title="Restart Loop from Marker A"
              >
                <RotateCcw size={16} />
                <span>Restart Loop</span>
              </button>
            </div>

            {/* A/B Boundary Fine-Tuning */}
            <div className="boundary-controls">
              <div className="boundary-group">
                <span className="boundary-label">Start Point (A):</span>
                <button
                  className="fine-btn"
                  onClick={() => adjustLoopA(-0.2)}
                  title="-0.2s"
                  aria-label="Decrease start point by 0.2 seconds"
                >
                  <Minus size={12} />
                </button>
                <span className="boundary-val">{loopA.toFixed(2)}s</span>
                <button
                  className="fine-btn"
                  onClick={() => adjustLoopA(0.2)}
                  title="+0.2s"
                  aria-label="Increase start point by 0.2 seconds"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="boundary-group">
                <span className="boundary-label">End Point (B):</span>
                <button
                  className="fine-btn"
                  onClick={() => adjustLoopB(-0.2)}
                  title="-0.2s"
                  aria-label="Decrease end point by 0.2 seconds"
                >
                  <Minus size={12} />
                </button>
                <span className="boundary-val">{loopB.toFixed(2)}s</span>
                <button
                  className="fine-btn"
                  onClick={() => adjustLoopB(0.2)}
                  title="+0.2s"
                  aria-label="Increase end point by 0.2 seconds"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Speed Control Strip */}
            <div className="practice-speed-strip">
              <span className="speed-label">
                <Gauge size={14} /> Tempo:
              </span>
              {[0.5, 0.75, 1.0, 1.25, 1.5].map((s) => (
                <button
                  key={s}
                  className={`speed-chip ${speed === s ? "is-selected" : ""}`}
                  onClick={() => handleSetSpeed(s)}
                  title={`Play at ${s}x speed (pitch preserved)`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section Looper Selector */}
        {sections.length > 0 && (
          <div className="practice-sections-panel">
            <span className="panel-title">Loop Whole Section:</span>
            <div className="sections-grid">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  className={`section-loop-card ${sec.type} ${
                    loopType === "section" && loopA === sec.time
                      ? "is-active"
                      : ""
                  }`}
                  onClick={() => handleSelectSection(sec)}
                >
                  <div className="card-top">
                    {sec.type === "chorus" ? (
                      <Sparkles size={14} />
                    ) : (
                      <Repeat size={14} />
                    )}
                    <span className="sec-title">{sec.label}</span>
                  </div>
                  <span className="sec-duration">
                    {(sec.endTime - sec.time).toFixed(1)}s loop
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Line Selector List */}
        <div className="practice-lines-panel">
          <span className="panel-title">Choose Line to Drill:</span>
          <div className="practice-lines-list">
            {parsedLyrics.map((line, idx) => {
              const isSelected = idx === selectedLineIndex && loopType === "line";
              return (
                <div
                  key={line.id || idx}
                  className={`practice-line-row ${
                    isSelected ? "is-selected-line" : ""
                  }`}
                  onClick={() => handleSelectLine(idx)}
                >
                  <span className="row-number">{idx + 1}</span>
                  <div className="row-text">
                    <span className="line-main">{line.text}</span>
                    {line.romanized && (
                      <span className="line-sub">{line.romanized}</span>
                    )}
                  </div>

                  <div className="row-badges">
                    {line.isFast && (
                      <span className="fast-chip">
                        <Zap size={11} /> Fast
                      </span>
                    )}
                    {line.isChorus && (
                      <span className="chorus-chip">
                        <Sparkles size={11} /> Hook
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
