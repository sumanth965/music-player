import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAdaptiveDifficulty,
  getTierScoringTolerances,
} from './difficultyEngine.js';

test('calculateAdaptiveDifficulty honors user manual overrides immediately', () => {
  const result = calculateAdaptiveDifficulty([], 'gentle');
  assert.equal(result.tier, 'gentle');
  assert.equal(result.isOverridden, true);
  assert.equal(result.centsTolerance, 65);

  const masterResult = calculateAdaptiveDifficulty([], 'master');
  assert.equal(masterResult.tier, 'master');
  assert.equal(masterResult.isOverridden, true);
  assert.equal(masterResult.centsTolerance, 25);
});

test('calculateAdaptiveDifficulty promotes to Master after 3 high accuracy sessions', () => {
  const topSessions = [
    { pitchAccuracy: 90, maxStreak: 12, validSampleRatio: 0.9 },
    { pitchAccuracy: 88, maxStreak: 10, validSampleRatio: 0.95 },
    { pitchAccuracy: 92, maxStreak: 14, validSampleRatio: 0.9 },
  ];

  const result = calculateAdaptiveDifficulty(topSessions);
  assert.equal(result.tier, 'master');
  assert.equal(result.isOverridden, false);
  assert.ok(result.reason.includes('Promoted to Master'));
});

test('calculateAdaptiveDifficulty eases down to Gentle when struggling across 2 sessions', () => {
  const strugglingSessions = [
    { pitchAccuracy: 52, maxStreak: 2, validSampleRatio: 0.8 },
    { pitchAccuracy: 55, maxStreak: 3, validSampleRatio: 0.85 },
    { pitchAccuracy: 70, maxStreak: 5, validSampleRatio: 0.85 },
  ];

  const result = calculateAdaptiveDifficulty(strugglingSessions);
  assert.equal(result.tier, 'gentle');
  assert.equal(result.centsTolerance, 65);
  assert.ok(result.reason.includes('Easing difficulty'));
});

test('calculateAdaptiveDifficulty ignores low mic quality takes', () => {
  const noisySessions = [
    { pitchAccuracy: 30, maxStreak: 1, validSampleRatio: 0.1 }, // Low mic quality
    { pitchAccuracy: 35, maxStreak: 1, validSampleRatio: 0.1 },
    { pitchAccuracy: 78, maxStreak: 7, validSampleRatio: 0.9 },
  ];

  const result = calculateAdaptiveDifficulty(noisySessions);
  // Noisy sessions are excluded; only 1 reliable session remains -> defaults to standard
  assert.equal(result.tier, 'standard');
});

test('getTierScoringTolerances calculates appropriate cents thresholds', () => {
  const gentle = getTierScoringTolerances('gentle');
  const master = getTierScoringTolerances('master');

  // Gentle tolerance should be wider than Master tolerance
  assert.ok(gentle.greatTolerance > master.greatTolerance);
  assert.ok(gentle.perfectTolerance > master.perfectTolerance);
});

