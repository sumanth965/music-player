import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations } from './recommendationEngine.js';

test('generateRecommendations provides friendly cold-start recommendations when history is sparse', () => {
  const recs = generateRecommendations([]);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].exerciseType, 'warmup');
  assert.equal(recs[0].difficultyLevel, 'Gentle');
  assert.ok(recs[0].reason.includes('Getting started'));
});

test('generateRecommendations targets verified weak sections with evidence', () => {
  const sessions = [
    {
      songTitle: 'Last Dance',
      validSampleRatio: 0.9,
      lineScores: [
        { lineIndex: 2, text: 'Difficult chorus line', status: 'miss', centsDiff: 75 },
      ],
    },
    {
      songTitle: 'Last Dance',
      validSampleRatio: 0.9,
      lineScores: [
        { lineIndex: 2, text: 'Difficult chorus line', status: 'miss', centsDiff: 85 },
      ],
    },
  ];

  const recs = generateRecommendations(sessions);
  const looperRec = recs.find((r) => r.exerciseType === 'looper');

  assert.ok(looperRec, 'Should recommend looper practice for difficult line');
  assert.equal(looperRec.actionPayload.songTitle, 'Last Dance');
  assert.equal(looperRec.actionPayload.lineIndex, 2);
  assert.ok(looperRec.reason.includes('missed pitch on this line'));
  assert.ok(looperRec.evidence.includes('2 attempts recorded'));
});

test('generateRecommendations suggests siren drill when upper register has low accuracy', () => {
  const sessions = [
    {
      validSampleRatio: 0.9,
      pitchAccuracy: 70,
      maxStreak: 6,
      lineScores: [
        { targetMidi: 60, centsDiff: 15 }, // mid - 85% acc
        { targetMidi: 72, centsDiff: 75 }, // high - 25% acc
      ],
    },
    {
      validSampleRatio: 0.9,
      pitchAccuracy: 72,
      maxStreak: 5,
      lineScores: [
        { targetMidi: 60, centsDiff: 20 },
        { targetMidi: 72, centsDiff: 80 },
      ],
    },
    {
      validSampleRatio: 0.9,
      pitchAccuracy: 71,
      maxStreak: 6,
      lineScores: [
        { targetMidi: 60, centsDiff: 15 },
        { targetMidi: 72, centsDiff: 70 },
      ],
    },
  ];

  const recs = generateRecommendations(sessions);
  const sirenRec = recs.find((r) => r.actionPayload?.drillId === 'siren');
  assert.ok(sirenRec, 'Should recommend siren drill for upper register strain');
  assert.ok(sirenRec.reason.includes('upper-register accuracy'));
});

