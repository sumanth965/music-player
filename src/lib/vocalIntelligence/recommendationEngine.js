/**
 * recommendationEngine.js
 * Generates personalized, explainable singing practice recommendations
 * based on verified historical practice sessions, weak sections, and vocal range profile.
 */

import { identifyWeakSections, analyzeRegisterAccuracy } from './weaknessAnalyzer.js';

/**
 * Standard drill references matching VocalWarmups.jsx
 */
export const DRILL_MAP = {
  'five-tone': {
    id: 'five-tone',
    name: '5-Tone Scale',
    defaultMinutes: 3,
    objective: 'Pitch stability and vocal cord warm-up',
  },
  'arpeggio': {
    id: 'arpeggio',
    name: 'Octave Arpeggio',
    defaultMinutes: 4,
    objective: 'Vocal range stretching and register transitions',
  },
  'siren': {
    id: 'siren',
    name: 'Siren Slide',
    defaultMinutes: 3,
    objective: 'Upper-register smoothing and eliminating vocal breaks',
  },
  'pentatonic': {
    id: 'pentatonic',
    name: 'Pentatonic Agility',
    defaultMinutes: 4,
    objective: 'Fast interval agility and ear-to-voice coordination',
  },
};

/**
 * Generates a list of targeted, explainable recommendations.
 *
 * @param {Array<Object>} sessions - Historical practice sessions
 * @param {Object} [vocalRange] - User's tested vocal range profile from getStoredVocalRange()
 * @returns {Array<Object>} Ranked list of recommendations with evidence strings
 */
export function generateRecommendations(sessions = [], vocalRange = null) {
  const recommendations = [];

  // Cold Start: Insufficient practice history
  if (!Array.isArray(sessions) || sessions.length < 2) {
    return [
      {
        id: 'rec-cold-warmup',
        exerciseType: 'warmup',
        title: 'Foundational 5-Tone Scale Warm-Up',
        reason: 'Getting started: Calibrate breath support and pitch centering before singing full songs.',
        evidence: 'Initial practice calibration',
        targetDurationMinutes: 3,
        difficultyLevel: 'Gentle',
        objective: 'Establish clean pitch onset and vocal cord readiness',
        actionPayload: { drillId: 'five-tone', rootKey: vocalRange?.classification === 'Bass' ? 'C' : 'D' },
      },
      {
        id: 'rec-cold-game',
        exerciseType: 'game',
        title: 'Sing-Along Pitch Benchmark',
        reason: 'Complete your first full song to baseline your intonation and identify vocal strengths.',
        evidence: 'Awaiting initial performance baseline',
        targetDurationMinutes: 4,
        difficultyLevel: 'Moderate',
        objective: 'Benchmark note accuracy and combo consistency across verses',
        actionPayload: {},
      },
    ];
  }

  // 1. Weak Song Section Recommendation (Top Priority if verified)
  const weakSections = identifyWeakSections(sessions, { minAttempts: 2 });
  if (weakSections.length > 0) {
    const topWeak = weakSections[0];
    recommendations.push({
      id: `rec-weak-${topWeak.songTitle}-${topWeak.lineIndex}`,
      exerciseType: 'looper',
      title: `Loop Difficult Phrase: "${topWeak.text.slice(0, 26)}..."`,
      reason: `You missed pitch on this line in ${Math.round(topWeak.missRate * 100)}% of your recent takes.`,
      evidence: `${topWeak.attempts} attempts recorded; avg pitch sag: ${topWeak.avgCentsDiff} cents off.`,
      targetDurationMinutes: 4,
      difficultyLevel: 'Moderate',
      objective: 'Master challenging syllable leaps and vowel placement at reduced speed',
      actionPayload: {
        songTitle: topWeak.songTitle,
        lineIndex: topWeak.lineIndex,
        text: topWeak.text,
      },
    });
  }

  // 2. High Register Strain vs Low Register Analysis
  const registerStats = analyzeRegisterAccuracy(sessions, vocalRange);
  if (registerStats.high !== null && registerStats.high < 65) {
    recommendations.push({
      id: 'rec-high-register',
      exerciseType: 'warmup',
      title: 'Siren Slide (Upper Register Smoothing)',
      reason: 'Your upper-register accuracy is lower than your mid-register singing.',
      evidence: `Upper-register accuracy averaged ${registerStats.high}% vs ${registerStats.mid || 80}% in mid-register.`,
      targetDurationMinutes: 3,
      difficultyLevel: 'Gentle',
      objective: 'Smooth head-voice transition and reduce vocal cord tension on higher notes',
      actionPayload: { drillId: 'siren', rootKey: 'F' },
    });
  } else if (registerStats.low !== null && registerStats.low < 65) {
    recommendations.push({
      id: 'rec-low-register',
      exerciseType: 'warmup',
      title: '5-Tone Scale (Chest-Voice Grounding)',
      reason: 'Your lowest register notes showed frequency drift below your speaking tone.',
      evidence: `Lower-register accuracy averaged ${registerStats.low}%.`,
      targetDurationMinutes: 3,
      difficultyLevel: 'Gentle',
      objective: 'Relax larynx and stabilize low-register pitch clarity',
      actionPayload: { drillId: 'five-tone', rootKey: 'C' },
    });
  }

  // 3. Pitch Instability / Jitter Pattern
  const recentSessions = sessions.slice(0, 5);
  const avgPitchAcc = Math.round(
    recentSessions.reduce((acc, s) => acc + (s.pitchAccuracy || 0), 0) / recentSessions.length
  );
  const maxStreakAvg = Math.round(
    recentSessions.reduce((acc, s) => acc + (s.maxStreak || 0), 0) / recentSessions.length
  );

  if (avgPitchAcc >= 70 && maxStreakAvg < 8) {
    recommendations.push({
      id: 'rec-pentatonic-agility',
      exerciseType: 'warmup',
      title: 'Pentatonic Agility Run',
      reason: 'Your accuracy is good, but streaks are interrupted by hesitant interval jumps.',
      evidence: `Recent sessions average ${avgPitchAcc}% accuracy but peak streak is only ${maxStreakAvg}.`,
      targetDurationMinutes: 4,
      difficultyLevel: 'Moderate',
      objective: 'Lock in faster note transitions and improve pitch agility',
      actionPayload: { drillId: 'pentatonic', rootKey: 'D' },
    });
  }

  // 4. Consistent High Mastery: Progression Challenge
  if (avgPitchAcc >= 88 && maxStreakAvg >= 12) {
    recommendations.push({
      id: 'rec-mastery-challenge',
      exerciseType: 'warmup',
      title: 'Octave Arpeggio Mastery Challenge',
      reason: 'Consistent top-tier singing demonstrated across recent sessions! Time to expand dynamic range.',
      evidence: `Recent session average accuracy: ${avgPitchAcc}%; peak streak: ${maxStreakAvg}.`,
      targetDurationMinutes: 5,
      difficultyLevel: 'Challenging',
      objective: 'Execute wide octave arpeggios with surgical pitch centering at full tempo',
      actionPayload: { drillId: 'arpeggio', rootKey: 'G' },
    });
  }

  // Fallback if no specific condition triggered
  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec-balanced-daily',
      exerciseType: 'warmup',
      title: 'Balanced Vocal Workout',
      reason: 'Regular daily vocal gym keeps cord elasticity and pitch muscle memory sharp.',
      evidence: `${sessions.length} total practice sessions completed to date.`,
      targetDurationMinutes: 4,
      difficultyLevel: 'Moderate',
      objective: 'Maintain balanced intonation and breath support across registers',
      actionPayload: { drillId: 'five-tone', rootKey: 'D' },
    });
  }

  return recommendations;
}

