/**
 * difficultyEngine.js
 * Rule-based adaptive difficulty system adjusting pitch tolerance thresholds,
 * tempo scalers, and interval complexities based on verifiable singer performance.
 * Never jumps abruptly; strictly avoids adapting on degraded microphone frames.
 */

export const DIFFICULTY_TIERS = {
  gentle: {
    name: 'Gentle',
    level: 1,
    centsTolerance: 65,      // Generous threshold for ear calibration
    tempoMultiplier: 0.85,    // Slower pace allows pitch centering
    warmupStepSeconds: 1.6,
    description: 'Forgiving pitch tolerance and relaxed tempo for comfortable muscle memory.',
  },
  standard: {
    name: 'Standard',
    level: 2,
    centsTolerance: 45,      // Musical intonation standard
    tempoMultiplier: 1.0,
    warmupStepSeconds: 1.3,
    description: 'Balanced performance standards for everyday vocal practice.',
  },
  master: {
    name: 'Master',
    level: 3,
    centsTolerance: 25,      // Strict professional tolerance (< quarter semitone)
    tempoMultiplier: 1.15,   // Accelerated agility
    warmupStepSeconds: 1.0,
    description: 'Strict pitch precision and agility requirements for advanced singers.',
  },
};

const DIFFICULTY_ORDER = ['gentle', 'standard', 'master'];

/**
 * Calculates adaptive difficulty tier based on recent practice history and manual overrides.
 *
 * @param {Array<Object>} sessions - Historical practice sessions (newest first)
 * @param {string | null} [manualOverride] - 'gentle' | 'standard' | 'master' | null
 * @returns {Object} Adaptive difficulty parameters
 */
export function calculateAdaptiveDifficulty(sessions = [], manualOverride = null) {
  // If user specified a manual override, honor it directly
  if (manualOverride && DIFFICULTY_TIERS[manualOverride]) {
    return {
      tier: manualOverride,
      ...DIFFICULTY_TIERS[manualOverride],
      isOverridden: true,
      reason: 'Manual preference selected by singer.',
    };
  }

  // Filter sessions with reliable microphone quality
  const reliableSessions = (sessions || []).filter((s) => (s.validSampleRatio ?? 1.0) >= 0.4);

  // Default to standard when insufficient history
  if (reliableSessions.length < 3) {
    return {
      tier: 'standard',
      ...DIFFICULTY_TIERS.standard,
      isOverridden: false,
      reason: 'Baseline calibration standard (requires 3 sessions to adapt).',
    };
  }

  const recent = reliableSessions.slice(0, 5);

  // Check Promotion Rule:
  // At least 3 recent consecutive sessions with >= 85% accuracy and streak >= 8
  const topThree = recent.slice(0, 3);
  const isMasterReady = topThree.length === 3 && topThree.every(
    (s) => (s.pitchAccuracy || 0) >= 85 && (s.maxStreak || 0) >= 8
  );

  if (isMasterReady) {
    return {
      tier: 'master',
      ...DIFFICULTY_TIERS.master,
      isOverridden: false,
      reason: 'Promoted to Master: 3 consecutive sessions exceeded 85% pitch accuracy.',
    };
  }

  // Check Demotion / Easing Rule:
  // At least 2 recent sessions with < 60% accuracy
  const recentTwo = recent.slice(0, 2);
  const needsEasing = recentTwo.length === 2 && recentTwo.every(
    (s) => (s.pitchAccuracy || 0) < 60
  );

  if (needsEasing) {
    return {
      tier: 'gentle',
      ...DIFFICULTY_TIERS.gentle,
      isOverridden: false,
      reason: 'Easing difficulty: Pitch tolerance broadened to help re-stabilize intonation.',
    };
  }

  // Default standard tier
  return {
    tier: 'standard',
    ...DIFFICULTY_TIERS.standard,
    isOverridden: false,
    reason: 'Standard tier matching your current performance range.',
  };
}

/**
 * Adjusts pitch scoring evaluation parameters according to current difficulty tier.
 * @param {string} tier
 * @returns {{ perfectTolerance: number, greatTolerance: number, goodTolerance: number }}
 */
export function getTierScoringTolerances(tier = 'standard') {
  const config = DIFFICULTY_TIERS[tier] || DIFFICULTY_TIERS.standard;
  const base = config.centsTolerance;

  return {
    perfectTolerance: Math.round(base * 0.55),
    greatTolerance: base,
    goodTolerance: Math.round(base * 1.6),
  };
}

