import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import cors from 'cors';
import {
  handleSearch,
  handleCollection,
  handleRecommendations,
  handleMood,
  handleTempo,
  handleTranscribe,
  MOODS,
} from './catalog.js';

test('catalog MOODS list contains standard definitions', () => {
  assert.ok(Array.isArray(MOODS));
  assert.ok(MOODS.length >= 5);
  const chill = MOODS.find((m) => m.id === 'chill');
  assert.ok(chill);
  assert.equal(chill.label, 'Chill');
});

test('server endpoints handle missing parameters gracefully', async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/search', handleSearch);
  app.get('/api/collection', handleCollection);
  app.get('/api/recommendations', handleRecommendations);
  app.get('/api/mood', handleMood);
  app.get('/api/tempo', handleTempo);
  app.post('/api/transcribe', handleTranscribe);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    // 1. Search without term -> 400
    const searchRes = await fetch(`http://localhost:${port}/api/search`);
    assert.equal(searchRes.status, 400);

    // 2. Collection without id -> 400
    const colRes = await fetch(`http://localhost:${port}/api/collection`);
    assert.equal(colRes.status, 400);

    // 3. Recommendations without artist/title -> 400
    const recRes = await fetch(`http://localhost:${port}/api/recommendations`);
    assert.equal(recRes.status, 400);

    // 4. Mood without valid mood -> 400
    const moodRes = await fetch(`http://localhost:${port}/api/mood?mood=invalid`);
    assert.equal(moodRes.status, 400);

    // 5. Transcribe without key -> 401
    const transRes = await fetch(`http://localhost:${port}/api/transcribe`, { method: 'POST' });
    assert.equal(transRes.status, 401);
  } finally {
    server.close();
  }
});
