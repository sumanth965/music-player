import test from 'node:test';
import assert from 'node:assert/strict';
import { countSyllables, parseWordLyrics, extractSectionChips, getActiveIndices } from './lyricStructure.js';

test('countSyllables accurately handles Latin and non-Latin words', () => {
  assert.equal(countSyllables('music'), 2);
  assert.equal(countSyllables('teleprompter'), 4);
  assert.equal(countSyllables('supercalifragilisticexpialidocious'), 14);
  assert.ok(countSyllables('नमस्ते') >= 2);
  assert.ok(countSyllables('ありがとう') >= 4);
});

test('parseWordLyrics parses line-level and word-level LRC lines', () => {
  const lrc = `[00:10.50]Hello world
[00:15.00]<00:15.00>Dancing <00:15.50>in <00:15.80>the <00:16.20>dark
[00:20.00]Hello world`;

  const parsed = parseWordLyrics(lrc);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].text, 'Hello world');
  assert.equal(parsed[1].words.length, 4);
  assert.equal(parsed[1].words[0].text, 'Dancing');
  assert.equal(parsed[1].words[1].text, 'in');

  // Chorus detection on repeating line
  assert.equal(parsed[0].isChorus, true);
  assert.equal(parsed[2].isChorus, true);
});

test('extractSectionChips creates jump chips with bounds', () => {
  const lines = [
    { text: 'Opening verse line 1', time: 0, endTime: 5, sectionName: 'Verse 1' },
    { text: 'Opening verse line 2', time: 5, endTime: 10, sectionName: 'Verse 1' },
    { text: 'Chorus line 1', time: 10, endTime: 15, sectionName: 'Chorus 1', isChorus: true },
    { text: 'Chorus line 2', time: 15, endTime: 20, sectionName: 'Chorus 1', isChorus: true },
  ];

  const chips = extractSectionChips(lines);
  assert.equal(chips.length, 2);
  assert.equal(chips[0].label, 'Verse 1');
  assert.equal(chips[0].time, 0);
  assert.equal(chips[1].label, 'Chorus 1');
  assert.equal(chips[1].time, 10);
});

test('getActiveIndices resolves active line and active word', () => {
  const lines = [
    {
      time: 5,
      endTime: 10,
      words: [
        { text: 'One', start: 5, end: 6 },
        { text: 'Two', start: 6, end: 7 },
      ],
    },
  ];

  const before = getActiveIndices(lines, 3);
  assert.equal(before.activeLineIndex, -1);

  const during = getActiveIndices(lines, 6.5);
  assert.equal(during.activeLineIndex, 0);
  assert.equal(during.activeWordIndex, 1);
});

test('interpolateMissingWords estimates syllable-proportional word intervals for line-timed lyrics', () => {
  const line = {
    text: 'Never gonna give you up',
    time: 10,
    endTime: 12.5,
  };

  const parsed = parseWordLyrics([line], { interpolateWords: true });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].words.length, 5);
  assert.equal(parsed[0].words[0].text, 'Never');
  assert.equal(parsed[0].words[0].interpolated, true);
  assert.equal(parsed[0].words[0].start, 10);
  assert.ok(parsed[0].words[4].end <= 12.5);
});
