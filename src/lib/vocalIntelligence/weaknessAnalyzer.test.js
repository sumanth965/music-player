import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasSufficientPracticeData,
  identifyWeakSections,
  analyzeRegisterAccuracy,
} from './weaknessAnalyzer.js';

test('hasSufficientPracticeData handles sparse and sufficient sessions properly', () => {
  assert.equal(hasSufficientPracticeData([]), false);
  assert.equal(hasSufficientPracticeData([{ score: 80, validSampleRatio: 0.2 }]), false); // low quality
  assert.equal(hasSufficientPracticeData([{ score: 80, validSampleRatio: 0.9 }]), false); // only 1 session

  const twoSessions = [
    { score: 80, validSampleRatio: 0.9, lineScores: [{ lineIndex: 0, status: 'good' }] },
    { score: 75, validSampleRatio: 0.85, lineScores: [{ lineIndex: 0, status: 'miss' }] },
  ];
  assert.equal(hasSufficientPracticeData(twoSessions), true);
});

test('identifyWeakSections excludes low mic signal quality and single-attempt noise', () => {
  const noisySessions = [
    {
      songTitle: 'Song A',
      validSampleRatio: 0.2, // Microphone cut out
      lineScores: [{ lineIndex: 0, text: 'Glitch line', status: 'miss', centsDiff: 90 }],
    },
    {
      songTitle: 'Song A',
      validSampleRatio: 0.9,
      lineScores: [{ lineIndex: 1, text: 'Single attempt line', status: 'miss', centsDiff: 80 }],
    },
  ];

  const results = identifyWeakSections(noisySessions, { minAttempts: 2 });
  // Glitch line has bad mic quality (rejected); single attempt line only has 1 attempt (rejected)
  assert.equal(results.length, 0);
});

test('identifyWeakSections ranks recurring difficulties by severity', () => {
  const sessions = [
    {
      songTitle: 'Last Dance',
      validSampleRatio: 0.9,
      lineScores: [
        { lineIndex: 0, text: 'Easy line', status: 'perfect', centsDiff: 10 },
        { lineIndex: 1, text: 'Tricky high note', status: 'miss', centsDiff: 75 },
        { lineIndex: 2, text: 'Medium line', status: 'good', centsDiff: 40 },
      ],
    },
    {
      songTitle: 'Last Dance',
      validSampleRatio: 0.85,
      lineScores: [
        { lineIndex: 0, text: 'Easy line', status: 'perfect', centsDiff: 15 },
        { lineIndex: 1, text: 'Tricky high note', status: 'miss', centsDiff: 85 },
        { lineIndex: 2, text: 'Medium line', status: 'good', centsDiff: 35 },
      ],
    },
  ];

  const weak = identifyWeakSections(sessions, { minAttempts: 2 });
  assert.equal(weak.length, 1);
  assert.equal(weak[0].lineIndex, 1);
  assert.equal(weak[0].text, 'Tricky high note');
  assert.equal(weak[0].attempts, 2);
  assert.equal(weak[0].missCount, 2);
  assert.equal(weak[0].missRate, 1.0);
  assert.ok(weak[0].severity >= 70);
});

test('analyzeRegisterAccuracy computes accurate breakdown without fabricating unmeasured data', () => {
  const sessions = [
    {
      lineScores: [
        { targetMidi: 50, centsDiff: 20 }, // Low
        { targetMidi: 60, centsDiff: 10 }, // Mid
        { targetMidi: 72, centsDiff: 80 }, // High
      ],
    },
    {
      lineScores: [
        { targetMidi: 50, centsDiff: 25 }, // Low
        { targetMidi: 60, centsDiff: 15 }, // Mid
        { targetMidi: 72, centsDiff: 70 }, // High
      ],
    },
    {
      lineScores: [
        { targetMidi: 50, centsDiff: 30 }, // Low
        { targetMidi: 60, centsDiff: 10 }, // Mid
        { targetMidi: 72, centsDiff: 75 }, // High
      ],
    },
  ];

  const breakdown = analyzeRegisterAccuracy(sessions);
  assert.ok(breakdown.low !== null);
  assert.ok(breakdown.mid !== null);
  assert.ok(breakdown.high !== null);

  // Mid accuracy (approx 88%) should be higher than High accuracy (approx 25%)
  assert.ok(breakdown.mid > breakdown.high);
});

