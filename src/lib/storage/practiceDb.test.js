import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSessionRecord,
  savePracticeSession,
  getPracticeHistory,
  deletePracticeSession,
  clearPracticeHistory,
  saveDailyPlan,
  getDailyPlan,
  getStoredVocalRange,
  setStoredVocalRange,
} from './practiceDb.js';

test('normalizeSessionRecord fills defaults for legacy v1 records', () => {
  const legacy = {
    id: 1,
    songTitle: 'Test Song',
    score: 80,
  };
  const normalized = normalizeSessionRecord(legacy);

  assert.equal(normalized.id, 1);
  assert.equal(normalized.songTitle, 'Test Song');
  assert.equal(normalized.exerciseType, 'game');
  assert.equal(normalized.grade, 'B');
  assert.equal(normalized.pitchAccuracy, 75);
  assert.equal(normalized.maxStreak, 0);
  assert.deepEqual(normalized.lineScores, []);
  assert.equal(normalized.difficultyTier, 'standard');
  assert.equal(normalized.validSampleRatio, 1.0);
});

test('practiceDb fallback CRUD, deletion, and daily plans', async () => {
  global.localStorage = {
    _store: {},
    getItem(k) { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = String(v); },
    removeItem(k) { delete this._store[k]; },
  };

  // Save session
  const id = await savePracticeSession({
    songTitle: 'Last Dance',
    score: 95,
    grade: 'S',
    pitchAccuracy: 92,
    exerciseType: 'game',
    lineScores: [
      { lineIndex: 0, text: 'First line', status: 'perfect', centsDiff: 10 },
      { lineIndex: 1, text: 'Second line', status: 'miss', centsDiff: 80 },
    ],
  });

  assert.ok(id > 0);

  // Retrieve and verify
  let history = await getPracticeHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].songTitle, 'Last Dance');
  assert.equal(history[0].lineScores.length, 2);

  // Save Daily Plan
  const planDate = '2026-11-08';
  const savedPlan = await saveDailyPlan({
    date: planDate,
    tasks: [{ id: 'task-1', title: '5-Tone Scale', completed: false }],
  });
  assert.equal(savedPlan, true);

  const plan = await getDailyPlan(planDate);
  assert.ok(plan);
  assert.equal(plan.tasks.length, 1);

  // Vocal Range
  const profile = { minNote: 'C3', maxNote: 'G4', classification: 'Baritone' };
  setStoredVocalRange(profile);
  const loadedProfile = getStoredVocalRange();
  assert.equal(loadedProfile.classification, 'Baritone');

  // Delete session
  const deleted = await deletePracticeSession(id);
  assert.equal(deleted, true);
  history = await getPracticeHistory();
  assert.equal(history.length, 0);

  // Clear
  await clearPracticeHistory();
  assert.equal(localStorage.getItem('swar_practice_history'), null);
  assert.equal(localStorage.getItem('swar_daily_plan'), null);

  delete global.localStorage;
});
