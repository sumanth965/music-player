import test from 'node:test';
import assert from 'node:assert/strict';
import {
  frequencyToMidi,
  midiToNoteDetails,
  evaluatePitchAccuracy,
  getStreakMultiplier,
  computePerformanceResults,
} from './pitchTracker.js';

test('frequencyToMidi converts standard frequencies correctly', () => {
  // A4 = 440 Hz -> MIDI 69
  assert.equal(Math.round(frequencyToMidi(440)), 69);
  // C4 ~ 261.63 Hz -> MIDI 60
  assert.equal(Math.round(frequencyToMidi(261.63)), 60);
  // A3 = 220 Hz -> MIDI 57
  assert.equal(Math.round(frequencyToMidi(220)), 57);
});

test('midiToNoteDetails returns correct note names and octaves', () => {
  const c4 = midiToNoteDetails(60);
  assert.equal(c4.fullName, 'C4');
  assert.equal(c4.name, 'C');
  assert.equal(c4.octave, 4);

  const a4 = midiToNoteDetails(69);
  assert.equal(a4.fullName, 'A4');
});

test('evaluatePitchAccuracy grades cents deviation with octave tolerance', () => {
  // Exact note
  const exact = evaluatePitchAccuracy(60, 60);
  assert.equal(exact.rating, 'perfect');
  assert.equal(exact.points, 100);

  // Octave transposition (e.g. 72 vs 60)
  const octave = evaluatePitchAccuracy(72, 60);
  assert.equal(octave.rating, 'perfect');

  // Slight flat / sharp (e.g. 50 cents)
  const close = evaluatePitchAccuracy(60.5, 60);
  assert.equal(close.rating, 'great');

  // Way off
  const off = evaluatePitchAccuracy(63, 60);
  assert.equal(off.rating, 'miss');
});

test('getStreakMultiplier scales with streak size', () => {
  assert.equal(getStreakMultiplier(2), 1);
  assert.equal(getStreakMultiplier(6), 2);
  assert.equal(getStreakMultiplier(15), 3);
  assert.equal(getStreakMultiplier(25), 4);
});

test('computePerformanceResults calculates grades accurately', () => {
  const result = computePerformanceResults({
    totalPoints: 950,
    maxPossiblePoints: 1000,
    pitchAccuracySum: 920,
    samplesCount: 10,
    timingAccuracySum: 88,
    maxStreak: 14,
    lineScores: [],
  });

  assert.equal(result.score, 95);
  assert.equal(result.grade, 'S');
  assert.equal(result.pitchAccuracy, 92);
  assert.equal(result.maxStreak, 14);
});
