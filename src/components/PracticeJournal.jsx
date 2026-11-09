import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Trophy,
  Award,
  Flame,
  Clock,
  Trash2,
  Sparkles,
  Music,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { getPracticeHistory, clearPracticeHistory, deletePracticeSession, getStoredVocalRange } from '../lib/storage/practiceDb';
import { analyzeVocalProgress } from '../lib/vocalIntelligence/progressAnalyzer';

export default function PracticeJournal({ onSelectSong }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    const data = await getPracticeHistory();
    setSessions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear your local practice history?')) {
      await clearPracticeHistory();
      setSessions([]);
    }
  };

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Delete this practice session?')) {
      await deletePracticeSession(id);
      await loadSessions();
    }
  };

  const vocalRange = getStoredVocalRange();
  const progress = analyzeVocalProgress(sessions, vocalRange);

  return (
    <div className="practice-journal-container" data-lenis-prevent>
      <div className="journal-header">
        <div className="journal-title-block">
          <Calendar size={20} className="journal-icon-glow" />
          <div>
            <h3 className="journal-title">Vocal Practice Journal</h3>
            <span className="journal-subtitle">
              Your private on-device singing progression, accuracy growth curves, and verified session logs.
            </span>
          </div>
        </div>

        {sessions.length > 0 && (
          <button
            className="journal-clear-btn"
            onClick={handleClear}
            title="Clear saved local practice logs"
          >
            <Trash2 size={15} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Overview Analytics Banner */}
      <div className="journal-stats-grid">
        <div className="journal-stat-card">
          <span className="stat-label">Total Sessions</span>
          <strong className="stat-value">{progress.totalSessions}</strong>
        </div>
        <div className="journal-stat-card">
          <span className="stat-label">This Week's Volume</span>
          <strong className="stat-value">{progress.weeklyDurationMinutes}m</strong>
        </div>
        <div className="journal-stat-card">
          <span className="stat-label">Avg Pitch Accuracy</span>
          <strong className="stat-value">{progress.avgAccuracy}%</strong>
        </div>
        <div className="journal-stat-card">
          <span className="stat-label">Best Rank</span>
          <strong className="stat-value grade-highlight">{progress.bestGrade}</strong>
        </div>
        <div className="journal-stat-card">
          <span className="stat-label">Peak Combo Streak</span>
          <strong className="stat-value">{progress.maxStreak}</strong>
        </div>
      </div>

      {/* Accuracy Progression Sparkline (Pure SVG) */}
      {progress.accuracyTrend.length >= 2 && (
        <div className="journal-trend-card">
          <div className="trend-card-top">
            <div className="trend-badge">
              <TrendingUp size={14} />
              <span>Intonation Progression Trend</span>
            </div>
            <span className="trend-subtext">Last {progress.accuracyTrend.length} Sessions</span>
          </div>

          <div className="trend-svg-wrapper">
            <svg viewBox="0 0 400 60" className="trend-svg" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="15" x2="400" y2="15" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              <line x1="0" y1="45" x2="400" y2="45" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

              {/* Sparkline Path */}
              <polyline
                fill="none"
                stroke="#ea580c"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={progress.accuracyTrend.map((pt, idx) => {
                  const x = (idx / (progress.accuracyTrend.length - 1)) * 390 + 5;
                  // Map accuracy 40%..100% to y 55..5
                  const y = 55 - ((Math.max(40, Math.min(100, pt.accuracy)) - 40) / 60) * 50;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ')}
              />

              {/* Data Dots */}
              {progress.accuracyTrend.map((pt, idx) => {
                const x = (idx / (progress.accuracyTrend.length - 1)) * 390 + 5;
                const y = 55 - ((Math.max(40, Math.min(100, pt.accuracy)) - 40) / 60) * 50;
                return (
                  <circle
                    key={idx}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r="3.5"
                    fill="#ea580c"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Session List */}
      <div className="journal-history-panel">
        <h4 className="panel-heading">Recent Practice Sessions</h4>

        {loading ? (
          <div className="journal-empty">Loading journal...</div>
        ) : sessions.length === 0 ? (
          <div className="journal-empty">
            <Music size={32} className="empty-icon" />
            <p>No practice sessions recorded yet.</p>
            <span>Sing along in Vocal Game or drill phrases in Practice Looper to log sessions!</span>
          </div>
        ) : (
          <div className="journal-cards-list">
            {sessions.map((s, idx) => (
              <div key={s.id || idx} className="journal-session-row">
                <div className={`session-grade-badge grade-${(s.grade || 'b').toLowerCase()}`}>
                  {s.grade || 'B'}
                </div>

                <div className="session-info">
                  <div className="session-title-row">
                    <span className="session-title">{s.songTitle || 'Practice Session'}</span>
                    <span className="exercise-type-tag">{s.exerciseType || 'game'}</span>
                  </div>
                  <span className="session-meta">
                    {s.artist && `${s.artist} • `}
                    {new Date(s.date).toLocaleDateString()} at{' '}
                    {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="session-metrics">
                  <span className="metric-pill">
                    <Award size={13} /> {s.pitchAccuracy || 0}% Accuracy
                  </span>
                  {s.maxStreak > 0 && (
                    <span className="metric-pill streak">
                      <Flame size={13} /> {s.maxStreak} Streak
                    </span>
                  )}
                  <button
                    className="delete-session-btn"
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
