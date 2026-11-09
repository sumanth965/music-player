import React from 'react';
import {
  Sparkles,
  Trophy,
  Award,
  Flame,
  CheckCircle,
  Circle,
  Play,
  RotateCcw,
  Zap,
  TrendingUp,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useVocalIntelligence } from '../../hooks/useVocalIntelligence';

export default function AdaptiveCoachDashboard({
  onStartWarmup,
  onOpenLooper,
  onOpenSingAlong,
  onOpenVocalRange,
}) {
  const {
    loading,
    sessions,
    vocalRange,
    dailyPlan,
    weakSections,
    recommendations,
    difficulty,
    progress,
    insights,
    toggleTask,
    setManualDifficulty,
  } = useVocalIntelligence();

  if (loading) {
    return (
      <div className="coach-loading-state">
        <Sparkles size={24} className="coach-icon-glow" />
        <span>Loading AI Vocal Coach Intelligence...</span>
      </div>
    );
  }

  const topOpportunity = recommendations[0] || null;

  const handleLaunchTask = (task) => {
    if (!task) return;
    if (task.category === 'warmup') {
      if (onStartWarmup) onStartWarmup(task.actionPayload?.drillId, task.actionPayload?.rootKey);
    } else if (task.category === 'looper') {
      if (onOpenLooper) onOpenLooper(task.actionPayload?.lineIndex, task.actionPayload?.songTitle);
    } else if (task.category === 'game') {
      if (onOpenSingAlong) onOpenSingAlong();
    }
  };

  return (
    <div className="adaptive-coach-dashboard" data-lenis-prevent>
      {/* Header Banner */}
      <div className="coach-header">
        <div className="coach-title-block">
          <Sparkles size={22} className="coach-icon-glow" />
          <div>
            <h2 className="coach-title">AI Vocal Coach & Practice Intelligence</h2>
            <span className="coach-subtitle">
              On-device intonation analysis, explainable recommendations, and adaptive training routines.
            </span>
          </div>
        </div>

        {/* Adaptive Difficulty Tier Selector */}
        <div className="difficulty-tier-picker" role="group" aria-label="Difficulty Tier">
          <span className="tier-label">
            <Layers size={13} /> Difficulty:
          </span>
          {['gentle', 'standard', 'master'].map((tierKey) => (
            <button
              key={tierKey}
              className={`tier-pill ${difficulty.tier === tierKey ? 'is-active' : ''}`}
              onClick={() => setManualDifficulty(tierKey)}
              title={tierKey === 'gentle' ? 'Forgiving ±65 cents' : tierKey === 'standard' ? 'Standard ±45 cents' : 'Strict ±25 cents'}
            >
              {tierKey.charAt(0).toUpperCase() + tierKey.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="coach-main-grid">
        {/* Left Column: Today's Practice Plan */}
        <div className="coach-card daily-plan-card">
          <div className="card-top-row">
            <div className="card-badge">
              <Clock size={14} />
              <span>Today's Routine</span>
            </div>
            <span className="plan-progress-tag">
              {dailyPlan?.completedCount || 0} of {dailyPlan?.totalTasks || 5} Complete ({dailyPlan?.totalDurationMinutes || 15} min)
            </span>
          </div>

          <h3 className="plan-title">{dailyPlan?.title || 'Daily Practice Routine'}</h3>

          <div className="plan-tasks-list">
            {dailyPlan?.tasks.map((task) => (
              <div
                key={task.id}
                className={`plan-task-item ${task.completed ? 'is-completed' : ''}`}
              >
                <button
                  className="task-check-btn"
                  onClick={() => toggleTask(task.id)}
                  aria-label={task.completed ? "Mark incomplete" : "Mark completed"}
                >
                  {task.completed ? (
                    <CheckCircle size={18} className="check-done" />
                  ) : (
                    <Circle size={18} className="check-todo" />
                  )}
                </button>

                <div className="task-content">
                  <div className="task-title-row">
                    <span className="task-name">{task.title}</span>
                    <span className="task-duration">{task.durationMinutes}m</span>
                  </div>
                  <span className="task-reason">{task.reason}</span>
                </div>

                <button
                  className="task-action-btn"
                  onClick={() => handleLaunchTask(task)}
                  title="Start this exercise"
                >
                  <Play size={13} />
                  <span>Start</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Top Opportunity & Explainable Coach Insights */}
        <div className="coach-right-col">
          {/* Top Improvement Opportunity */}
          {topOpportunity && (
            <div className="coach-card opportunity-card">
              <div className="card-top-row">
                <div className="card-badge opportunity-badge">
                  <Zap size={14} />
                  <span>Top Improvement Opportunity</span>
                </div>
                <span className="opp-level">{topOpportunity.difficultyLevel}</span>
              </div>

              <h4 className="opp-title">{topOpportunity.title}</h4>
              <p className="opp-reason">{topOpportunity.reason}</p>

              <div className="opp-evidence-box">
                <ShieldCheck size={14} className="evidence-icon" />
                <span>Evidence: {topOpportunity.evidence}</span>
              </div>

              <button
                className="opp-cta-btn"
                onClick={() => {
                  if (topOpportunity.exerciseType === 'warmup') {
                    if (onStartWarmup) onStartWarmup(topOpportunity.actionPayload?.drillId, topOpportunity.actionPayload?.rootKey);
                  } else if (topOpportunity.exerciseType === 'looper') {
                    if (onOpenLooper) onOpenLooper(topOpportunity.actionPayload?.lineIndex, topOpportunity.actionPayload?.songTitle);
                  } else if (onOpenSingAlong) {
                    onOpenSingAlong();
                  }
                }}
              >
                <Play size={15} />
                <span>Practice Recommended Exercise</span>
              </button>
            </div>
          )}

          {/* Coach Insights Bullets */}
          <div className="coach-card insights-card">
            <div className="card-top-row">
              <div className="card-badge">
                <TrendingUp size={14} />
                <span>Evidence-Based Vocal Insights</span>
              </div>
            </div>

            <div className="insights-list">
              {insights.map((ins) => (
                <div key={ins.id} className={`insight-bullet ${ins.type}`}>
                  <strong className="insight-headline">{ins.headline}</strong>
                  <p className="insight-msg">{ins.message}</p>
                  <span className="insight-evidence">Evidence: {ins.evidence}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Weak Sections Panel */}
      {weakSections.length > 0 && (
        <div className="coach-card weak-sections-card">
          <div className="card-top-row">
            <div className="card-badge caution-badge">
              <AlertCircle size={14} />
              <span>Recurring Difficult Sections ({weakSections.length})</span>
            </div>
            <span className="card-note">Ranked by pitch deviation across verified attempts</span>
          </div>

          <div className="weak-sections-grid">
            {weakSections.slice(0, 3).map((w, idx) => (
              <div key={idx} className="weak-section-row">
                <div className="weak-section-info">
                  <span className="weak-song">{w.songTitle} • Line {w.lineIndex + 1}</span>
                  <span className="weak-lyric">"{w.text}"</span>
                  <span className="weak-reason">{w.reason}</span>
                </div>

                <button
                  className="weak-action-btn"
                  onClick={() => onOpenLooper && onOpenLooper(w.lineIndex, w.songTitle)}
                  title="Drill this exact phrase in Practice Looper"
                >
                  <RotateCcw size={14} />
                  <span>Drill in Looper</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress & Consistency Summary Strip */}
      <div className="coach-stats-strip">
        <div className="stat-pill">
          <span className="stat-num">{progress.totalSessions}</span>
          <span className="stat-lbl">Sessions Logged</span>
        </div>
        <div className="stat-pill">
          <span className="stat-num">{progress.weeklyDurationMinutes}m</span>
          <span className="stat-lbl">Practiced This Week</span>
        </div>
        <div className="stat-pill">
          <span className="stat-num">{progress.avgAccuracy}%</span>
          <span className="stat-lbl">Average Pitch Accuracy</span>
        </div>
        <div className="stat-pill">
          <span className="stat-num">{vocalRange?.classification || 'Calibrate'}</span>
          <span className="stat-lbl">Vocal Range</span>
        </div>
        <div className="stat-pill">
          <span className="stat-num">{progress.maxStreak}</span>
          <span className="stat-lbl">Peak Combo Streak</span>
        </div>
      </div>
    </div>
  );
}

