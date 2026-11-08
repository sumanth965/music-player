import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVocalProgress } from './progressAnalyzer.js';
import { generateDailyPlan, togglePlanTask } from './practicePlanGenerator.js';
import { generateCoachInsights } from './vocalInsights.js';

test('analyzeVocalProgress aggregates duration, trends, and consistency without errors', () => {
  const sessions = [
    {
      date: new Date().toISOString(),
      songTitle: 'Last Dance',
      durationSeconds: 180,
      exerciseType: 'game',
      pitchAccuracy: 90,
      grade: 'S',
      maxStreak: 12,
    },
    {
      date: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      songTitle: 'Last Dance',
      durationSeconds: 120,
      exerciseType: 'looper',
      pitchAccuracy: 85,
      grade: 'A',
      maxStreak: 8,
    },
    {
      date: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      songTitle: 'Warm-Up',
      durationSeconds: 180,
      exerciseType: 'warmup',
      pitchAccuracy: 88,
      grade: 'A',
      maxStreak: 10,
    },
  ];

  const progress = analyzeVocalProgress(sessions);
  assert.equal(progress.totalSessions, 3);
  assert.equal(progress.warmupsCompleted, 1);
  assert.equal(progress.bestGrade, 'S');
  assert.equal(progress.maxStreak, 12);
  assert.equal(progress.mostPracticedSong, 'Last Dance');
  assert.ok(progress.accuracyTrend.length === 3);
});

test('generateDailyPlan generates 5 structured steps and toggles task completion', () => {
  const plan = generateDailyPlan([]);
  assert.ok(plan.tasks.length === 5);
  assert.equal(plan.completedCount, 0);
  assert.equal(plan.tasks[0].completed, false);

  const updated = togglePlanTask(plan, 'task-warmup-cord');
  assert.equal(updated.completedCount, 1);
  assert.equal(updated.tasks[0].completed, true);

  const untoggled = togglePlanTask(updated, 'task-warmup-cord');
  assert.equal(untoggled.completedCount, 0);
  assert.equal(untoggled.tasks[0].completed, false);
});

test('generateCoachInsights provides honest feedback without inventing claims on sparse data', () => {
  // Cold start
  const coldInsights = generateCoachInsights([]);
  assert.equal(coldInsights.length, 1);
  assert.equal(coldInsights[0].type, 'info');
  assert.ok(coldInsights[0].headline.includes('Awaiting Practice History'));

  // With growth trend
  const sessions = [
    { date: '2026-11-08', pitchAccuracy: 92, maxStreak: 12 },
    { date: '2026-11-07', pitchAccuracy: 85, maxStreak: 10 },
    { date: '2026-11-06', pitchAccuracy: 80, maxStreak: 8 },
  ];
  const insights = generateCoachInsights(sessions);
  const growthInsight = insights.find((i) => i.id === 'insight-acc-growth');
  assert.ok(growthInsight, 'Should detect intonation growth');
  assert.ok(growthInsight.headline.includes('+12%'));
});

