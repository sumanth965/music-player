import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleDegreeToMidi,
  getLineMelodyTarget,
  getWordMelodyTargets,
  ROOT_MIDI_MAP,
} from './vocalMelody.js';

test('scaleDegreeToMidi calculates musical pentatonic and major steps', () => {
  // C4 = 60
  // Pentatonic scale: [0, 2, 4, 7, 9]
  assert.equal(scaleDegreeToMidi(0, 60, true), 60); // C4
  assert.equal(scaleDegreeToMidi(1, 60, true), 62); // D4
  assert.equal(scaleDegreeToMidi(2, 60, true), 64); // E4
  assert.equal(scaleDegreeToMidi(3, 60, true), 67); // G4
  assert.equal(scaleDegreeToMidi(4, 60, true), 69); // A4
  assert.equal(scaleDegreeToMidi(5, 60, true), 72); // C5 (octave up)

  // Major scale: [0, 2, 4, 5, 7, 9, 11]
  assert.equal(scaleDegreeToMidi(0, 60, false), 60); // C4
  assert.equal(scaleDegreeToMidi(3, 60, false), 65); // F4
  assert.equal(scaleDegreeToMidi(6, 60, false), 71); // B4
  assert.equal(scaleDegreeToMidi(7, 60, false), 72); // C5
});

test('getLineMelodyTarget prefers explicit metadata if present', () => {
  const lineWithTarget = { text: 'Hello', targetPitch: 67 };
  assert.equal(getLineMelodyTarget(lineWithTarget), 67);
});

test('getLineMelodyTarget creates coherent melodic phrase contour', () => {
  const line0 = { text: 'Verse line 1' };
  const line1 = { text: 'Verse line 2' };
  const line2 = { text: 'Verse line 3' };
  const line3 = { text: 'Verse line 4' };

  const target0 = getLineMelodyTarget(line0, 0, 4);
  const target1 = getLineMelodyTarget(line1, 1, 4);
  const target2 = getLineMelodyTarget(line2, 2, 4);
  const target3 = getLineMelodyTarget(line3, 3, 4);

  // Line 0 is root (60)
  assert.equal(target0, 60);
  // Line 1 arches up
  assert.ok(target1 > target0);
  // Line 2 arches to climax
  assert.ok(target2 >= target1);
  // Line 3 resolves back to root
  assert.equal(target3, 60);
});

test('getLineMelodyTarget lifts chorus sections for dynamic vocal energy', () => {
  const verse = { text: 'Verse text', isChorus: false };
  const chorus = { text: 'Chorus hook', isChorus: true };

  const versePitch = getLineMelodyTarget(verse, 0, 4);
  const chorusPitch = getLineMelodyTarget(chorus, 0, 4);

  assert.ok(chorusPitch > versePitch, 'Chorus should have higher vocal pitch register');
});

test('getWordMelodyTargets creates word-level pitch curves', () => {
  const line = {
    text: 'Fly me to the moon',
    words: [
      { text: 'Fly', time: 1.0, endTime: 1.5 },
      { text: 'me', time: 1.5, endTime: 2.0 },
      { text: 'to', time: 2.0, endTime: 2.5 },
      { text: 'the', time: 2.5, endTime: 2.8 },
      { text: 'moon', time: 2.8, endTime: 4.0 },
    ],
  };

  const words = getWordMelodyTargets(line, 0);
  assert.equal(words.length, 5);
  assert.equal(words[0].word, 'Fly');
  assert.ok(words[0].midi >= 48 && words[0].midi <= 84);
});

