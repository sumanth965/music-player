/**
 * practicePlanGenerator.js
 * Generates personalized, balanced daily practice plans (10-15 minutes)
 * targeting verified weak sections, warm-ups, and repertoire mastery.
 */

import { identifyWeakSections } from './weaknessAnalyzer.js';

/**
 * Gets today's date in local YYYY-MM-DD format.
 * @returns {string}
 */
export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates a fresh daily vocal practice plan based on historical practice signals.
 *
 * @param {Array<Object>} sessions - Historical sessions
 * @param {Object} [vocalRange] - Tested vocal range
 * @param {string} [dateString] - YYYY-MM-DD (defaults to today)
 * @returns {Object} Daily plan
 */
export function generateDailyPlan(sessions = [], vocalRange = null, dateString = null) {
  const planDate = dateString || getTodayDateString();
  const weakSections = identifyWeakSections(sessions, { minAttempts: 2 });
  const topWeak = weakSections.length > 0 ? weakSections[0] : null;

  const comfortableRoot = vocalRange?.classification === 'Bass' ? 'C' : 'D';

  const tasks = [
    {
      id: 'task-warmup-cord',
      stepNumber: 1,
      title: 'Vocal Cord Priming (5-Tone Scale)',
      durationMinutes: 2,
      category: 'warmup',
      reason: 'Wakes up vocal cord elasticity and centers intonation before heavier singing.',
      completed: false,
      skipped: false,
      actionPayload: { drillId: 'five-tone', rootKey: comfortableRoot },
    },
    {
      id: 'task-warmup-flex',
      stepNumber: 2,
      title: 'Upper-Register Glissando (Siren Slide)',
      durationMinutes: 3,
      category: 'warmup',
      reason: 'Smooths register break between chest voice and head voice.',
      completed: false,
      skipped: false,
      actionPayload: { drillId: 'siren', rootKey: 'F' },
    },
    {
      id: 'task-weak-drill',
      stepNumber: 3,
      title: topWeak
        ? `Phrase Drill: "${topWeak.text.slice(0, 24)}..." (${topWeak.songTitle})`
        : 'Interval Precision Run (Pentatonic)',
      durationMinutes: 4,
      category: topWeak ? 'looper' : 'warmup',
      reason: topWeak
        ? `Targeting your top opportunity: missed pitch in ${Math.round(topWeak.missRate * 100)}% of recent attempts.`
        : 'Locks in clean interval leaps and ear-to-voice coordination.',
      completed: false,
      skipped: false,
      actionPayload: topWeak
        ? { songTitle: topWeak.songTitle, lineIndex: topWeak.lineIndex }
        : { drillId: 'pentatonic', rootKey: 'D' },
    },
    {
      id: 'task-repertoire',
      stepNumber: 4,
      title: topWeak
        ? `Repertoire Run: ${topWeak.songTitle}`
        : 'Full Song Sing-Along Benchmark',
      durationMinutes: 4,
      category: 'game',
      reason: 'Applies calibrated technique to full musical context with accompaniment.',
      completed: false,
      skipped: false,
      actionPayload: topWeak ? { songTitle: topWeak.songTitle } : {},
    },
    {
      id: 'task-review',
      stepNumber: 5,
      title: 'Vocal Take Playback Review',
      durationMinutes: 2,
      category: 'review',
      reason: 'Self-monitoring: listen back to your recorded take to evaluate timbre and pitch stability.',
      completed: false,
      skipped: false,
      actionPayload: {},
    },
  ];

  return {
    date: planDate,
    title: `Daily Vocal Routine (${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })})`,
    totalDurationMinutes: tasks.reduce((sum, t) => sum + t.durationMinutes, 0),
    tasks,
    completedCount: 0,
    totalTasks: tasks.length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Toggles a task's completion status within a plan.
 * @param {Object} plan
 * @param {string} taskId
 * @returns {Object} Updated plan copy
 */
export function togglePlanTask(plan, taskId) {
  if (!plan || !Array.isArray(plan.tasks)) return plan;

  const updatedTasks = plan.tasks.map((t) => {
    if (t.id === taskId) {
      return { ...t, completed: !t.completed, skipped: false };
    }
    return t;
  });

  const completedCount = updatedTasks.filter((t) => t.completed).length;

  return {
    ...plan,
    tasks: updatedTasks,
    completedCount,
    lastUpdated: new Date().toISOString(),
  };
}

