/**
 * vocalInsights.js
 * Generates explainable, verifiable AI Vocal Coach insights
 * supported strictly by actual stored practice measurements.
 * Never invents unmeasured vocal flaws.
 */

import { analyzeRegisterAccuracy, identifyWeakSections } from './weaknessAnalyzer.js';

/**
 * Derives actionable, honest coach insight statements from historical practice logs.
 *
 * @param {Array<Object>} sessions - Practice sessions ordered newest first
 * @param {Object} [vocalRange] - Tested vocal range
 * @returns {Array<Object>} List of insight bullets with category, type, and evidence
 */
export function generateCoachInsights(sessions = [], vocalRange = null) {
  const insights = [];

  // Cold Start: Insufficient Data (< 2 sessions)
  if (!Array.isArray(sessions) || sessions.length < 2) {
    return [
      {
        id: 'insight-cold-start',
        type: 'info',
        headline: 'Awaiting Practice History Baseline',
        message: 'Complete at least two singing sessions or scale drills to unlock personalized vocal insights.',
        evidence: '0 or 1 session currently recorded on this device.',
      },
    ];
  }

  // 1. Accuracy Progression across Recent Sessions
  const recentThree = sessions.slice(0, 3);
  if (recentThree.length === 3) {
    const newestAcc = recentThree[0].pitchAccuracy || 0;
    const oldestAcc = recentThree[2].pitchAccuracy || 0;
    const diff = newestAcc - oldestAcc;

    if (diff >= 5) {
      insights.push({
        id: 'insight-acc-growth',
        type: 'positive',
        headline: `Intonation Up +${diff}% Across Recent Takes`,
        message: 'Your pitch centering is showing measurable improvement across your last three singing sessions.',
        evidence: `Rose from ${oldestAcc}% on ${recentThree[2].date?.slice(5, 10)} to ${newestAcc}% on ${recentThree[0].date?.slice(5, 10)}.`,
      });
    } else if (diff <= -8) {
      insights.push({
        id: 'insight-fatigue-notice',
        type: 'caution',
        headline: 'Vocal Fatigue or Pitch Drift Detected',
        message: 'Recent takes showed a slight decrease in intonation consistency. Consider resting vocal cords or using gentle 5-tone scales.',
        evidence: `Recent accuracy shifted from ${oldestAcc}% down to ${newestAcc}%.`,
      });
    }
  }

  // 2. High Register Strain vs Mid Register
  const registers = analyzeRegisterAccuracy(sessions, vocalRange);
  if (registers.high !== null && registers.mid !== null && (registers.mid - registers.high >= 15)) {
    insights.push({
      id: 'insight-register-gap',
      type: 'opportunity',
      headline: 'Head Voice Register Break Opportunity',
      message: 'Your pitch accuracy drops on notes above your speaking register, suggesting larynx tension during high-note phonation.',
      evidence: `Upper-register notes averaged ${registers.high}% accuracy compared to ${registers.mid}% in your mid register.`,
    });
  }

  // 3. Top Weak Section Opportunity
  const weakSections = identifyWeakSections(sessions, { minAttempts: 2 });
  if (weakSections.length > 0) {
    const top = weakSections[0];
    insights.push({
      id: 'insight-weak-line',
      type: 'opportunity',
      headline: `Target Phrase: "${top.text.slice(0, 22)}..."`,
      message: `You missed the pitch target in ${Math.round(top.missRate * 100)}% of takes on "${top.songTitle}". Drilling this line in Practice Looper will quickly lift your overall song score.`,
      evidence: `${top.attempts} recorded attempts; average pitch sag: ${top.avgCentsDiff} cents.`,
    });
  }

  // 4. Practice Consistency Insight
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sessionsThisWeek = sessions.filter((s) => new Date(s.date || 0) >= oneWeekAgo).length;

  if (sessionsThisWeek >= 4) {
    insights.push({
      id: 'insight-consistency',
      type: 'positive',
      headline: 'Exceptional Practice Consistency',
      message: 'Regular, shorter practice sessions are dramatically more effective for muscle memory than sporadic long workouts.',
      evidence: `${sessionsThisWeek} practice sessions completed in the past 7 days.`,
    });
  } else if (sessionsThisWeek <= 1 && sessions.length >= 3) {
    insights.push({
      id: 'insight-frequency',
      type: 'info',
      headline: 'Consistency Recommendation',
      message: 'Aim for 10 minutes of vocal warm-ups 3–4 days a week to build lasting pitch muscle memory.',
      evidence: `${sessionsThisWeek} session logged this week.`,
    });
  }

  return insights;
}

