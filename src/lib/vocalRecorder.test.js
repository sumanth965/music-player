import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSupportedAudioMimeType,
  formatAudioDuration,
  getTakeFilename,
} from './vocalRecorder.js';

test('formatAudioDuration formats seconds into MM:SS correctly', () => {
  assert.equal(formatAudioDuration(0), '00:00');
  assert.equal(formatAudioDuration(5), '00:05');
  assert.equal(formatAudioDuration(65), '01:05');
  assert.equal(formatAudioDuration(3599), '59:59');
  assert.equal(formatAudioDuration(-10), '00:00');
  assert.equal(formatAudioDuration(null), '00:00');
});

test('getTakeFilename generates sanitized filenames with date', () => {
  const name = getTakeFilename('Last Dance (Remix)', 'webm');
  assert.match(name, /^swar_last_dance__remix__\d{4}-\d{2}-\d{2}\.webm$/);

  const fallback = getTakeFilename('', 'mp3');
  assert.match(fallback, /^swar_take_\d{4}-\d{2}-\d{2}\.mp3$/);
});

test('getSupportedAudioMimeType falls back gracefully in Node environment', () => {
  assert.equal(getSupportedAudioMimeType(), null);

  // Simulated browser environment with MediaRecorder
  global.MediaRecorder = {
    isTypeSupported(type) {
      return type.includes('audio/webm');
    },
  };

  assert.equal(getSupportedAudioMimeType(), 'audio/webm;codecs=opus');

  delete global.MediaRecorder;
});

