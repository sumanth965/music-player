import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTranscriptionResult,
  audioBufferToWavBlob,
  getGroqApiKey,
} from './audioTranscription.js';

test('formatTranscriptionResult processes segments and words correctly', () => {
  const mockGroqResponse = {
    text: 'Sing freely. We will keep you on track.',
    duration: 2.63,
    language: 'English',
    words: [
      { word: 'Sing', start: 0.12, end: 0.28 },
      { word: 'freely.', start: 0.28, end: 1.0 },
      { word: 'We', start: 1.0, end: 1.1 },
      { word: 'will', start: 1.1, end: 1.32 },
      { word: 'keep', start: 1.32, end: 1.54 },
      { word: 'you', start: 1.54, end: 1.78 },
      { word: 'on', start: 1.78, end: 1.98 },
      { word: 'track.', start: 1.98, end: 2.68 },
    ],
    segments: [
      {
        id: 0,
        start: 0,
        end: 2.36,
        text: 'Sing freely. We will keep you on track.',
      },
    ],
  };

  const result = formatTranscriptionResult(mockGroqResponse, 'groq');
  assert.equal(result.status, 'completed');
  assert.equal(result.transcript, 'Sing freely. We will keep you on track.');
  assert.equal(result.sync, 'word');
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].text, 'Sing freely. We will keep you on track.');
  assert.equal(result.lines[0].words.length, 8);
  assert.equal(result.lines[0].words[0].text, 'Sing');
  assert.equal(result.lines[0].words[0].start, 0.12);
});

test('formatTranscriptionResult handles plain text fallback without segments', () => {
  const mockPlainResponse = {
    text: 'Line one of song. Line two of song.',
    duration: 10,
    language: 'English',
  };

  const result = formatTranscriptionResult(mockPlainResponse, 'groq');
  assert.equal(result.status, 'completed');
  assert.equal(result.sync, 'line');
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].text, 'Line one of song.');
});

test('audioBufferToWavBlob generates valid WAV structure', () => {
  // Mock AudioBuffer
  const mockBuffer = {
    numberOfChannels: 1,
    sampleRate: 16000,
    length: 1600, // 0.1 second of audio
    getChannelData: () => new Float32Array(1600),
  };

  const blob = audioBufferToWavBlob(mockBuffer);
  assert.equal(blob.type, 'audio/wav');
  // Header is 44 bytes + 1600 samples * 2 bytes = 3244 bytes
  assert.equal(blob.size, 44 + 3200);
});

test('getGroqApiKey provides a key or string fallback', () => {
  const key = getGroqApiKey();
  assert.equal(typeof key, 'string');
});

