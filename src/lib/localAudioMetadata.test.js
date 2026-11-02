import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrackFromFilename,
  parseLrcText,
  cleanTitleArtifacts,
  getBaseName,
  getExtension,
  isAudioFile,
  isLyricFile
} from './localAudioMetadata.js';

test('parseTrackFromFilename cleans common patterns', () => {
  assert.deepEqual(
    parseTrackFromFilename('Queen - Bohemian Rhapsody.mp3'),
    { artist: 'Queen', title: 'Bohemian Rhapsody', album: '' }
  );

  assert.deepEqual(
    parseTrackFromFilename('01. The Weeknd - Blinding Lights (Official Video).flac'),
    { artist: 'The Weeknd', title: 'Blinding Lights', album: '' }
  );

  assert.deepEqual(
    parseTrackFromFilename('03 - Yesterday.wav'),
    { artist: '', title: 'Yesterday', album: '' }
  );

  assert.deepEqual(
    parseTrackFromFilename('Coldplay - Parachutes - 01 - Don\'t Panic.m4a'),
    { artist: 'Coldplay', album: 'Parachutes', title: 'Don\'t Panic' }
  );

  assert.deepEqual(
    parseTrackFromFilename('Ed Sheeran - Shape of You [Lyric Video] [HQ].opus'),
    { artist: 'Ed Sheeran', title: 'Shape of You', album: '' }
  );
});

test('cleanTitleArtifacts removes rip tags', () => {
  assert.equal(
    cleanTitleArtifacts('Song Title (Official Music Video) [4K]'),
    'Song Title'
  );
  assert.equal(
    cleanTitleArtifacts('Another Song (Remastered 2011) [320kbps]'),
    'Another Song'
  );
});

test('parseLrcText parses standard and multi-timestamp LRC files', () => {
  const lrc = `
[ti:Bohemian Rhapsody]
[ar:Queen]
[al:A Night at the Opera]
[00:01.50]Is this the real life?
[00:05.20]Is this just fantasy?
[00:10.00][00:20.00]Caught in a landslide
`;

  const parsed = parseLrcText(lrc);
  assert.ok(parsed);
  assert.equal(parsed.title, 'Bohemian Rhapsody');
  assert.equal(parsed.artist, 'Queen');
  assert.equal(parsed.album, 'A Night at the Opera');
  assert.equal(parsed.sync, 'line');
  assert.equal(parsed.lines.length, 4);
  assert.equal(parsed.lines[0].time, 1.5);
  assert.equal(parsed.lines[0].text, 'Is this the real life?');
  assert.equal(parsed.lines[1].time, 5.2);
  assert.equal(parsed.lines[1].text, 'Is this just fantasy?');
  // Two repeated lines at 10.0 and 20.0
  assert.equal(parsed.lines[2].time, 10.0);
  assert.equal(parsed.lines[2].text, 'Caught in a landslide');
  assert.equal(parsed.lines[3].time, 20.0);
  assert.equal(parsed.lines[3].text, 'Caught in a landslide');
});

test('parseLrcText falls back gracefully to plain text without timestamps', () => {
  const text = `
First line of lyrics
Second line of lyrics
Third line
`;
  const parsed = parseLrcText(text);
  assert.ok(parsed);
  assert.equal(parsed.sync, 'plain');
  assert.equal(parsed.lines.length, 3);
  assert.equal(parsed.lines[0].text, 'First line of lyrics');
  assert.equal(parsed.lines[1].text, 'Second line of lyrics');
  assert.equal(parsed.lines[2].text, 'Third line');
});

test('file type identification works', () => {
  assert.equal(isAudioFile({ name: 'song.mp3', type: 'audio/mpeg' }), true);
  assert.equal(isAudioFile({ name: 'track.flac', type: '' }), true);
  assert.equal(isAudioFile({ name: 'readme.txt', type: 'text/plain' }), false);

  assert.equal(isLyricFile({ name: 'song.lrc' }), true);
  assert.equal(isLyricFile({ name: 'lyrics.txt' }), true);
  assert.equal(isLyricFile({ name: 'song.mp3' }), false);

  assert.equal(getBaseName('folder/my-track.flac'), 'my-track');
  assert.equal(getExtension('song.OPUS'), 'opus');
});
