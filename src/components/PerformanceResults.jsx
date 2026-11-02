import React from "react";
import {
  Trophy,
  Award,
  Zap,
  Repeat,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
  Share2,
} from "lucide-react";

export default function PerformanceResults({
  results,
  track,
  onPracticeLine,
  onPlayAgain,
  onClose,
}) {
  const {
    score = 0,
    grade = "B",
    pitchAccuracy = 80,
    timingAccuracy = 85,
    maxStreak = 0,
    totalPoints = 0,
    lineScores = [],
  } = results || {};

  const gradeColors = {
    S: "grade-s",
    A: "grade-a",
    B: "grade-b",
    C: "grade-c",
    D: "grade-d",
  };

  return (
    <div className="performance-results-modal">
      <div className="results-backdrop" onClick={onClose} />
      <div className="results-card">
        {/* Header */}
        <div className="results-header">
          <div className="header-badge">
            <Trophy size={20} className="trophy-glow" />
            <span>Vocal Performance Card</span>
          </div>
          {onClose && (
            <button className="results-close-btn" onClick={onClose} aria-label="Close performance results">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Track Title */}
        <div className="results-song-info">
          <span className="results-song-title">{track?.title || "Song Performance"}</span>
          <span className="results-song-artist">{track?.artist || "Artist"}</span>
        </div>

        {/* Score & Letter Grade Banner */}
        <div className="results-banner">
          <div className={`letter-grade-circle ${gradeColors[grade] || "grade-b"}`}>
            <span className="grade-letter">{grade}</span>
            <span className="grade-subtext">Rank</span>
          </div>

          <div className="results-score-block">
            <div className="score-number-row">
              <span className="score-big">{score}</span>
              <span className="score-percent">%</span>
            </div>
            <span className="score-subtext">
              {score >= 90
                ? "Phenomenal performance! Pitch perfect."
                : score >= 80
                ? "Great vocal control and rhythm!"
                : score >= 65
                ? "Good effort! A few tricky lines to master."
                : "Keep practicing! Use the looper to master difficult lines."}
            </span>
          </div>
        </div>

        {/* Breakdown Stats Grid */}
        <div className="results-stats-grid">
          <div className="stat-card">
            <span className="stat-label">Pitch Accuracy</span>
            <div className="stat-bar-track">
              <div
                className="stat-bar-fill pitch-bar"
                style={{ width: `${pitchAccuracy}%` }}
              />
            </div>
            <span className="stat-value">{pitchAccuracy}%</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Rhythm & Timing</span>
            <div className="stat-bar-track">
              <div
                className="stat-bar-fill timing-bar"
                style={{ width: `${timingAccuracy}%` }}
              />
            </div>
            <span className="stat-value">{timingAccuracy}%</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Best Streak</span>
            <div className="stat-streak-val">
              <Zap size={16} className="streak-icon" />
              <span>{maxStreak} Hits</span>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-label">Total Points</span>
            <span className="stat-points-val">{totalPoints.toLocaleString()}</span>
          </div>
        </div>

        {/* Per-Line Review */}
        {lineScores.length > 0 && (
          <div className="line-review-section">
            <h4 className="review-title">Per-Line Breakdown & Practice</h4>
            <div className="review-list">
              {lineScores.map((item, idx) => (
                <div key={idx} className={`review-row ${item.status || "good"}`}>
                  <div className="review-row-text">
                    <span className="row-line-text">{item.text}</span>
                    <div className="row-meta">
                      <span className={`status-pill ${item.status || "good"}`}>
                        {item.status === "perfect"
                          ? "Perfect 100%"
                          : item.status === "good"
                          ? "Good Pitch"
                          : "Needs Work"}
                      </span>
                      {item.centsDiff !== undefined && (
                        <span className="cents-pill">
                          ±{Math.abs(item.centsDiff)} cents
                        </span>
                      )}
                    </div>
                  </div>

                  {onPracticeLine && (
                    <button
                      className="drill-line-btn"
                      onClick={() => onPracticeLine(item.lineIndex ?? idx)}
                      title="Drill this line in Looper Mode"
                    >
                      <Repeat size={13} />
                      <span>Drill</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="results-footer">
          {onPlayAgain && (
            <button className="results-btn play-again-btn" onClick={onPlayAgain}>
              <RotateCcw size={16} />
              <span>Sing Again</span>
            </button>
          )}

          <button className="results-btn done-btn" onClick={onClose}>
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
}
