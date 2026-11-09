import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AnimatePresence,
  motion as Motion,
  useReducedMotion,
  animate,
} from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Repeat,
  Sparkles,
  Zap,
  Mic2,
  Sliders,
  ChevronRight,
  RotateCcw,
  Languages,
  ArrowDownCircle,
  X,
  LoaderCircle,
} from "lucide-react";
import { useStore } from "../hooks/useStore";
import {
  parseWordLyrics,
  extractSectionChips,
  getActiveIndices,
} from "../lib/lyricStructure";
import SongTextData from "./SongTextData";

export default function LyricsStudio({
  player,
  onOpenPractice,
  onOpenSingAlong,
  onClose,
  initialFocus = false,
}) {
  const reduce = useReducedMotion();
  const [isFocusMode, setIsFocusMode] = useState(initialFocus);
  const [showFixPanel, setShowFixPanel] = useState(false);
  const [scriptMode, setScriptMode] = useState("both"); // 'both' | 'native' | 'romanized'
  const [fontSize, setFontSize] = useState("normal"); // 'small' | 'normal' | 'large' | 'huge'
  const [userScrolled, setUserScrolled] = useState(false);

  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const scrollAnimRef = useRef(null);
  const userScrollTimeoutRef = useRef(null);

  // Parse lyrics with smart chorus and word timings
  const parsedLyrics = useMemo(() => {
    return parseWordLyrics(player.lyrics);
  }, [player.lyrics]);

  // Section chips for 1-click jumps
  const sections = useMemo(() => {
    return extractSectionChips(parsedLyrics);
  }, [parsedLyrics]);

  // Subscribe to high-frequency clock outside React component re-renders
  const currentTime = useStore(player.clock, (time) => time);
  const offset = player.lyricsOffset || 0;
  const effectiveTime = currentTime + offset;

  // Active indices
  const { activeLineIndex, activeWordIndex } = useMemo(() => {
    return getActiveIndices(parsedLyrics, effectiveTime);
  }, [parsedLyrics, effectiveTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (userScrolled || !containerRef.current || !activeLineRef.current) return;
    const box = containerRef.current;
    const target = activeLineRef.current;

    const targetTop =
      target.offsetTop - box.clientHeight / 2 + target.clientHeight / 2;

    if (reduce) {
      box.scrollTop = targetTop;
      return;
    }

    if (scrollAnimRef.current) scrollAnimRef.current.stop();
    scrollAnimRef.current = animate(box.scrollTop, Math.max(0, targetTop), {
      duration: 1.1,
      ease: [0.25, 1, 0.5, 1],
      onUpdate: (v) => {
        box.scrollTop = v;
      },
    });

    return () => {
      if (scrollAnimRef.current) scrollAnimRef.current.stop();
    };
  }, [activeLineIndex, userScrolled, reduce]);

  // Detect manual scroll
  const handleScroll = () => {
    setUserScrolled(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      // Keep paused until resume button clicked or after 6s of inactivity
      setUserScrolled(false);
    }, 6000);
  };

  const handleResumeScroll = () => {
    setUserScrolled(false);
  };

  const handleSeek = (time) => {
    player.seek(Math.max(0, time - offset));
    setUserScrolled(false);
  };

  // Keyboard shortcut: F for Focus, Esc to exit
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        setIsFocusMode((prev) => !prev);
      } else if (e.key === "Escape") {
        if (isFocusMode) setIsFocusMode(false);
        else if (onClose) onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFocusMode, onClose]);

  const fontSizeClass = {
    small: "studio-font-sm",
    normal: "studio-font-md",
    large: "studio-font-lg",
    huge: "studio-font-xl",
  }[fontSize];

  return (
    <div
      className={`lyrics-studio-container ${
        isFocusMode ? "is-focus-mode" : ""
      } ${fontSizeClass}`}
    >
      {/* Studio Header Toolbar */}
      <div className="studio-toolbar">
        <div className="studio-toolbar-left">
          <div className="studio-brand">
            <Sparkles size={18} className="brand-icon-pulse" />
            <span className="studio-title">Lyrics Teleprompter</span>
          </div>

          {/* Dual Script Toggle */}
          <div
            className="studio-pill-group"
            role="group"
            aria-label="Script Mode"
          >
            <button
              className={`studio-pill-btn ${
                scriptMode === "both" ? "is-active" : ""
              }`}
              onClick={() => setScriptMode("both")}
              title="Show both Native and Romanized script"
            >
              Both
            </button>
            <button
              className={`studio-pill-btn ${
                scriptMode === "romanized" ? "is-active" : ""
              }`}
              onClick={() => setScriptMode("romanized")}
              title="Romanized Phonetics only"
            >
              Romanized
            </button>
            <button
              className={`studio-pill-btn ${
                scriptMode === "native" ? "is-active" : ""
              }`}
              onClick={() => setScriptMode("native")}
              title="Native script only"
            >
              Native
            </button>
          </div>

          {/* Quick Real-Time Sync Offset Nudge */}
          <div className="studio-offset-pill-group" title="Nudge lyrics timing earlier or later to match singing audio">
            <button
              type="button"
              className="offset-mini-btn"
              onClick={() => player.setLyricsOffset?.(Math.round(((player.lyricsOffset || 0) - 0.5) * 10) / 10)}
              title="Shift lyrics 0.5s earlier"
            >
              -0.5s
            </button>
            <button
              type="button"
              className="offset-mini-btn"
              onClick={() => player.setLyricsOffset?.(Math.round(((player.lyricsOffset || 0) - 0.1) * 10) / 10)}
              title="Shift lyrics 0.1s earlier"
            >
              -0.1s
            </button>
            <button
              type="button"
              className="offset-val-btn"
              onClick={() => player.setLyricsOffset?.(0)}
              title="Click to reset offset to 0.0s"
            >
              Sync: {(player.lyricsOffset || 0) > 0 ? "+" : ""}{(player.lyricsOffset || 0).toFixed(1)}s
            </button>
            <button
              type="button"
              className="offset-mini-btn"
              onClick={() => player.setLyricsOffset?.(Math.round(((player.lyricsOffset || 0) + 0.1) * 10) / 10)}
              title="Shift lyrics 0.1s later"
            >
              +0.1s
            </button>
            <button
              type="button"
              className="offset-mini-btn"
              onClick={() => player.setLyricsOffset?.(Math.round(((player.lyricsOffset || 0) + 0.5) * 10) / 10)}
              title="Shift lyrics 0.5s later"
            >
              +0.5s
            </button>
          </div>
        </div>

        <div className="studio-toolbar-right">
          {/* Font Sizer */}
          <div className="studio-font-controls">
            {["small", "normal", "large", "huge"].map((size) => (
              <button
                key={size}
                className={`studio-font-btn ${
                  fontSize === size ? "is-active" : ""
                }`}
                onClick={() => setFontSize(size)}
              >
                {size[0].toUpperCase()}
              </button>
            ))}
          </div>

          {/* Fix Lyrics / Options Action */}
          <button
            className={`studio-action-btn fix-action ${showFixPanel ? "is-active" : ""}`}
            onClick={() => setShowFixPanel(!showFixPanel)}
            title="Fix mismatched song lyrics, search alternative, paste text, or transcribe with AI Whisper"
          >
            <Sliders size={15} />
            <span>{showFixPanel ? "Close Fix" : "Fix Lyrics"}</span>
          </button>

          {/* Practice Looper Shortcut */}
          {onOpenPractice && (
            <button
              className="studio-action-btn practice-action"
              onClick={() => onOpenPractice(activeLineIndex)}
              title="Open Line & Section Practice Looper"
            >
              <Repeat size={16} />
              <span>Practice</span>
            </button>
          )}

          {/* Vocal Gaming Shortcut */}
          {onOpenSingAlong && (
            <button
              className="studio-action-btn gaming-action"
              onClick={onOpenSingAlong}
              title="Sing Along & Real-time Vocal Pitch Game"
            >
              <Mic2 size={16} />
              <span>Vocal Game</span>
            </button>
          )}

          {/* Focus Mode Toggle */}
          <button
            className="studio-icon-btn"
            onClick={() => setIsFocusMode(!isFocusMode)}
            title={isFocusMode ? "Exit Focus (Esc)" : "Full Focus Mode (F)"}
            aria-label="Toggle Focus Mode"
          >
            {isFocusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Close Studio */}
          {onClose && (
            <button
              className="studio-icon-btn close-btn"
              onClick={onClose}
              title="Close Lyrics Studio"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Chorus & Section Jump Chips Bar */}
      {sections.length > 0 && !showFixPanel && (
        <div className="studio-sections-bar">
          <span className="sections-label">Jump to:</span>
          <div className="sections-scroll">
            {sections.map((sec) => (
              <button
                key={sec.id}
                className={`section-chip ${sec.type} ${
                  activeLineIndex >= 0 &&
                  sec.lineIndices.includes(activeLineIndex)
                    ? "is-current"
                    : ""
                }`}
                onClick={() => handleSeek(sec.time)}
              >
                {sec.type === "chorus" && <Sparkles size={12} />}
                <span>{sec.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lyrics Correction, Custom Search, and Audio Transcription Drawer */}
      <AnimatePresence>
        {showFixPanel && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="studio-fix-drawer-wrapper"
            style={{
              overflow: "hidden",
              background: "rgba(18, 12, 8, 0.98)",
              borderBottom: "1px solid rgba(242, 138, 50, 0.2)",
            }}
          >
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "16px", color: "#ffffff" }}>
                    Fix & Synchronize Lyrics
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#d1c2b4" }}>
                    Search by verified title/artist, transcribe live audio with AI Whisper, adjust sync timing, or paste lyrics.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-pill-button sm-btn"
                  onClick={() => setShowFixPanel(false)}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <X size={14} />
                  <span>Done</span>
                </button>
              </div>
              <SongTextData player={player} onClose={() => setShowFixPanel(false)} />
            </div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Main Lyrics Teleprompter Stream */}
      <div
        className="studio-lyrics-viewport"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {player.lyricsLoading ? (
          <div className="studio-loading-state" role="status" aria-live="polite">
            <LoaderCircle size={32} className="spin" style={{ color: "var(--accent, #ea580c)" }} />
            <h3 style={{ margin: "16px 0 6px", fontSize: "18px", color: "var(--text-primary, #2b1b11)" }}>
              Finding the right words...
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary, #7a685b)" }}>
              Searching synchronized lyrics from Swar audio cloud
            </p>
          </div>
        ) : parsedLyrics.length === 0 ? (
          <div className="studio-empty-state">
            <SongTextData player={player} />
          </div>
        ) : (
          <div className="studio-lines-list">
            {parsedLyrics.map((line, idx) => {
              const isActive = idx === activeLineIndex;
              const isPast = idx < activeLineIndex;
              const isChorus = line.isChorus;

              return (
                <div
                  key={line.id || idx}
                  ref={isActive ? activeLineRef : null}
                  className={`studio-line ${
                    isActive ? "is-active" : isPast ? "is-past" : "is-future"
                  } ${isChorus ? "is-chorus-line" : ""} ${
                    line.isFast ? "is-fast-drill" : ""
                  }`}
                  onClick={() => handleSeek(line.time)}
                  title="Click to seek"
                >
                  <div className="line-content-wrap">
                    {/* Native or Main Line */}
                    {(scriptMode === "both" || scriptMode === "native") && (
                      <div className="line-text native-text">
                        {line.words && line.words.length > 0 ? (
                          line.words.map((word, wIdx) => {
                            const isWordActive =
                              isActive && wIdx === activeWordIndex;
                            const isWordSung =
                              isActive && wIdx < activeWordIndex;

                            return (
                              <span
                                key={wIdx}
                                className={`teleprompter-word ${
                                  isWordActive
                                    ? "word-active"
                                    : isWordSung
                                    ? "word-sung"
                                    : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(word.start);
                                }}
                              >
                                {word.text}{" "}
                              </span>
                            );
                          })
                        ) : (
                          <span>{line.text}</span>
                        )}
                      </div>
                    )}

                    {/* Romanized Phonetic Script */}
                    {(scriptMode === "both" || scriptMode === "romanized") &&
                      line.romanized && (
                        <div className="line-text romanized-text">
                          <span>{line.romanized}</span>
                        </div>
                      )}
                  </div>

                  {/* Line Badges & Actions */}
                  <div className="line-meta-side">
                    {line.isFast && (
                      <span
                        className="fast-drill-badge"
                        title={`${line.syllablesPerSec} syllables/sec`}
                      >
                        <Zap size={11} /> {line.syllablesPerSec}/s
                      </span>
                    )}
                    {isChorus && (
                      <span className="chorus-badge">
                        <Sparkles size={10} /> Hook
                      </span>
                    )}
                    {onOpenPractice && (
                      <button
                        className="line-practice-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPractice(idx);
                        }}
                        title="Loop this line in Practice Mode"
                      >
                        <Repeat size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resume Auto-Scroll floating pill */}
      <AnimatePresence>
        {userScrolled && (
          <Motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="studio-resume-scroll-pill"
            onClick={handleResumeScroll}
          >
            <ArrowDownCircle size={15} />
            <span>Resume Auto-Scroll</span>
          </Motion.button>
        )}
      </AnimatePresence>

      {/* Focus Mode Integrated Transport Bar */}
      {isFocusMode && (
        <div className="studio-focus-transport">
          <div className="focus-track-info">
            <span className="focus-title">{player.track?.title}</span>
            <span className="focus-artist">{player.track?.artist}</span>
          </div>

          <div className="focus-controls">
            <button
              className="transport-btn"
              onClick={player.previous}
              title="Previous"
              aria-label="Previous track"
            >
              <SkipBack size={18} />
            </button>
            <button
              className="transport-btn play-pause-btn"
              onClick={player.togglePlay}
              title={player.playing ? "Pause" : "Play"}
              aria-label={player.playing ? "Pause" : "Play"}
            >
              {player.playing ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" />
              )}
            </button>
            <button
              className="transport-btn"
              onClick={player.next}
              title="Next"
              aria-label="Next track"
            >
              <SkipForward size={18} />
            </button>
          </div>

          <div className="focus-right-actions">
            <button
              className="exit-focus-btn"
              onClick={() => setIsFocusMode(false)}
            >
              Exit Focus (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
