/**
 * catalog.ts
 * Implements catalogue search, collection browsing, recommendations,
 * mood tracks, tempo / BPM lookups, and secure AI Whisper transcription.
 */

import { Request, Response } from 'express';
import axios from 'axios';

// ─── Helpers & Types ──────────────────────────────────────────────────────────
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'US',
  },
};

const fold = (val: any) =>
  String(val || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

const safeHttps = (val: any) => (typeof val === 'string' && val.startsWith('https://') ? val : '');

export const MOODS = [
  { id: 'chill', label: 'Chill', query: 'chill relaxing acoustic' },
  { id: 'focus', label: 'Focus', query: 'lofi ambient study' },
  { id: 'energy', label: 'Energy', query: 'workout high energy dance' },
  { id: 'feel-good', label: 'Feel-good', query: 'happy uplifting pop' },
  { id: 'party', label: 'Party', query: 'party club dance' },
  { id: 'sleep', label: 'Sleep', query: 'sleep peaceful calm' },
  { id: 'melancholy', label: 'Melancholy', query: 'sad acoustic emotional' },
];

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'spanish',
  pt: 'brazil',
  fr: 'french',
  de: 'german',
  it: 'italian',
  el: 'greek',
  tr: 'turkish',
  ko: 'k-pop',
  ja: 'j-pop',
  zh: 'chinese',
  ar: 'arabic',
  hi: 'bollywood',
  nl: 'dutch',
  pl: 'polish',
  sv: 'swedish',
  ro: 'romanian',
  cyrl: 'russian',
  id: 'indonesian',
};

// Caches
const searchCache = new Map<string, { data: any; until: number }>();
const collectionCache = new Map<string, { data: any; until: number }>();
const recommendationCache = new Map<string, { data: any; until: number }>();
const moodCache = new Map<string, { data: any; until: number }>();
const tempoCache = new Map<string, { data: any; until: number }>();

const remember = (map: Map<string, any>, key: string, data: any, ttlMs: number) => {
  if (map.size >= 500) {
    const oldest = map.keys().next().value;
    if (oldest) map.delete(oldest);
  }
  map.set(key, { data, until: Date.now() + ttlMs });
  return data;
};

// ─── InnerTube YouTube Client ────────────────────────────────────────────────
async function innertube(endpoint: string, body: any, timeout = 5000) {
  const url = `https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_KEY}`;
  const res = await axios.post(url, { context: INNERTUBE_CONTEXT, ...body }, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.youtube.com',
    },
    timeout,
  });
  return res.data;
}

function parseSeconds(val: any): number {
  if (!val) return 0;
  const parts = String(val).trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((tot, p) => tot * 60 + p, 0);
}

function textOf(node: any): string {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (typeof node.content === 'string') return node.content;
  if (Array.isArray(node.runs)) return node.runs.map((r: any) => r.text || '').join('');
  return '';
}

async function searchYouTubeInner(query: string, type: 'videos' | 'playlists', limit = 20) {
  const params = type === 'videos' ? 'EgIQAQ==' : 'EgIQAw==';
  try {
    const data = await innertube('search', { query, params });
    const items: any[] = [];
    
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.videoRenderer && type === 'videos') {
        const vr = node.videoRenderer;
        const videoId = vr.videoId;
        if (/^[\w-]{11}$/.test(videoId)) {
          const title = textOf(vr.title);
          const channel = textOf(vr.ownerText || vr.shortBylineText);
          const thumbs = vr.thumbnail?.thumbnails || [];
          const artwork = thumbs[thumbs.length - 1]?.url || '';
          const dur = parseSeconds(textOf(vr.lengthText));
          items.push({
            videoId,
            title,
            artist: channel,
            artwork: artwork.startsWith('//') ? `https:${artwork}` : artwork,
            duration: dur,
          });
        }
      } else if (node.playlistRenderer && type === 'playlists') {
        const pr = node.playlistRenderer;
        const id = pr.playlistId;
        if (id) {
          const thumbs = pr.thumbnails?.[0]?.thumbnails || [];
          items.push({
            id,
            title: textOf(pr.title),
            artist: textOf(pr.shortBylineText),
            artwork: thumbs[thumbs.length - 1]?.url || '',
            count: Number(pr.videoCount) || 0,
          });
        }
      }
      for (const key of Object.keys(node)) {
        walk(node[key]);
      }
    };

    walk(data);
    return items.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Search Handlers ──────────────────────────────────────────────────────────
async function itunes(term: string, entity: string, limit: number) {
  const res = await axios.get('https://itunes.apple.com/search', {
    params: { term, entity, limit: String(limit) },
    timeout: 8000,
  });
  return Array.isArray(res.data?.results) ? res.data.results : [];
}

export async function handleSearch(req: Request, res: Response) {
  const term = String(req.query.term || '').trim();
  const type = String(req.query.type || 'songs').trim();

  if (!term || term.length > 200) {
    return res.status(400).json({ error: 'Search term between 1 and 200 characters is required.' });
  }

  const cacheKey = `${type}::${term.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.until > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const isAll = type === 'all';
    const songLimit = isAll ? 20 : 36;
    const albumLimit = isAll ? 8 : 24;
    const artistLimit = isAll ? 6 : 16;
    const videoLimit = isAll ? 10 : 24;
    const playlistLimit = isAll ? 6 : 16;

    const tasks: Record<string, Promise<any>> = {};

    if (isAll || type === 'songs') {
      tasks.songs = itunes(term, 'song', songLimit).then((items: any[]) =>
        items
          .filter((item: any) => item && Number.isSafeInteger(item.trackId) && item.trackName)
          .slice(0, songLimit)
      );
    }

    if (isAll || type === 'albums') {
      tasks.albums = itunes(term, 'album', albumLimit).then((items: any[]) =>
        items
          .filter((item: any) => item && Number.isSafeInteger(item.collectionId) && item.collectionName)
          .map((item: any) => ({
            id: item.collectionId,
            title: item.collectionName,
            artist: item.artistName,
            artwork: safeHttps(item.artworkUrl100).replace(/100x100bb/, '600x600bb'),
            count: item.trackCount || 0,
            year: String(item.releaseDate || '').slice(0, 4),
          }))
          .slice(0, albumLimit)
      );
    }

    if (isAll || type === 'artists') {
      tasks.artists = axios
        .get('https://api.deezer.com/search/artist', {
          params: { q: term, limit: String(artistLimit) },
          timeout: 8000,
        })
        .then((r) =>
          (r.data?.data || [])
            .filter((item: any) => Number.isSafeInteger(item?.id) && item.name)
            .map((item: any) => ({
              id: item.id,
              name: item.name,
              artwork: safeHttps(item.picture_xl || item.picture_big),
              fans: item.nb_fan || 0,
            }))
            .slice(0, artistLimit)
        )
        .catch(() => []);
    }

    if (isAll || type === 'videos') {
      tasks.videos = searchYouTubeInner(term, 'videos', videoLimit);
    }

    if (isAll || type === 'playlists') {
      tasks.playlists = searchYouTubeInner(term, 'playlists', playlistLimit);
    }

    const settled = await Promise.allSettled(Object.values(tasks));
    const keys = Object.keys(tasks);
    const result: Record<string, any> = {
      results: [],
      albums: [],
      artists: [],
      videos: [],
      playlists: [],
    };

    keys.forEach((key, i) => {
      const outcome = settled[i];
      const val = outcome.status === 'fulfilled' ? outcome.value : [];
      if (key === 'songs') result.results = val;
      else result[key] = val;
    });

    if (isAll) {
      const topArtist = result.artists?.[0];
      if (topArtist && fold(topArtist.name) === fold(term)) {
        result.top = { kind: 'artist', id: topArtist.id };
      } else if (result.results?.[0]) {
        result.top = { kind: 'song', id: result.results[0].trackId };
      } else if (result.videos?.[0]) {
        result.top = { kind: 'video', id: result.videos[0].videoId };
      } else {
        result.top = null;
      }
    }

    remember(searchCache, cacheKey, result, 300_000); // 5 min cache
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.json(result);
  } catch (err: any) {
    console.error('[Catalog Search Error]', err);
    return res.status(502).json({ error: 'Search is temporarily unavailable.' });
  }
}

// ─── Collection Handler ───────────────────────────────────────────────────────
export async function handleCollection(req: Request, res: Response) {
  const type = String(req.query.type || '');
  const id = String(req.query.id || '');

  if (!type || !id) {
    return res.status(400).json({ error: 'Valid collection type and id are required.' });
  }

  const cacheKey = `${type}::${id}`;
  const cached = collectionCache.get(cacheKey);
  if (cached && cached.until > Date.now()) {
    return res.json(cached.data);
  }

  try {
    if (type === 'album') {
      const resp = await axios.get('https://itunes.apple.com/lookup', {
        params: { id, entity: 'song', limit: '200' },
        timeout: 8000,
      });
      const [collection, ...rest] = resp.data?.results || [];
      const tracks = rest
        .filter((item: any) => item.wrapperType === 'track' && Number.isSafeInteger(item.trackId))
        .sort(
          (a: any, b: any) =>
            (a.discNumber || 1) - (b.discNumber || 1) || (a.trackNumber || 0) - (b.trackNumber || 0)
        )
        .map((item: any) => ({
          id: String(item.trackId),
          title: item.trackName,
          artist: item.artistName,
          artistId: item.artistId,
          album: item.collectionName || '',
          artwork: safeHttps(item.artworkUrl100).replace(/100x100bb/, '600x600bb'),
          duration: Number(item.trackTimeMillis) / 1000 || 0,
          genre: item.primaryGenreName,
        }));

      const out = {
        title: collection?.collectionName || '',
        subtitle: [collection?.artistName, String(collection?.releaseDate || '').slice(0, 4)]
          .filter(Boolean)
          .join(' · '),
        artwork: safeHttps(collection?.artworkUrl100).replace(/100x100bb/, '600x600bb'),
        tracks,
      };
      remember(collectionCache, cacheKey, out, 1_800_000);
      return res.json(out);
    }

    if (type === 'artist') {
      const [artistRes, topRes] = await Promise.all([
        axios.get(`https://api.deezer.com/artist/${id}`, { timeout: 8000 }),
        axios.get(`https://api.deezer.com/artist/${id}/top?limit=30`, { timeout: 8000 }),
      ]);
      const artist = artistRes.data || {};
      const tracks = (topRes.data?.data || [])
        .filter((item: any) => Number.isSafeInteger(item.id))
        .map((item: any) => ({
          id: `deezer:${item.id}`,
          title: item.title,
          artist: item.artist?.name,
          artistId: item.artist?.id,
          album: item.album?.title || '',
          artwork: safeHttps(item.album?.cover_xl || item.album?.cover_big),
          duration: Number(item.duration) || 0,
        }));

      const out = {
        title: artist.name || '',
        subtitle: 'Top songs',
        artwork: safeHttps(artist.picture_xl || artist.picture_big),
        tracks,
      };
      remember(collectionCache, cacheKey, out, 1_800_000);
      return res.json(out);
    }

    return res.status(400).json({ error: 'Unsupported collection type.' });
  } catch (err: any) {
    console.error('[Catalog Collection Error]', err);
    return res.status(502).json({ error: 'This collection could not be loaded.' });
  }
}

// ─── Recommendations Handler ──────────────────────────────────────────────────
export async function handleRecommendations(req: Request, res: Response) {
  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();

  if (!artist || !title) {
    return res.status(400).json({ error: 'Artist and title are required.' });
  }

  const cacheKey = `${artist}::${title}`.toLowerCase();
  const cached = recommendationCache.get(cacheKey);
  if (cached && cached.until > Date.now()) {
    return res.json(cached.data);
  }

  try {
    // Look up similar tracks via iTunes search for the artist and genre
    const resp = await axios.get('https://itunes.apple.com/search', {
      params: { term: artist, entity: 'song', limit: '30' },
      timeout: 8000,
    });

    const currentKey = fold(title);
    const seen = new Set<string>([currentKey]);

    const tracks = (resp.data?.results || [])
      .filter((item: any) => {
        if (!item || !item.trackId || !item.trackName) return false;
        const k = fold(item.trackName);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 16)
      .map((item: any) => ({
        id: String(item.trackId),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName || '',
        artwork: safeHttps(item.artworkUrl100).replace(/100x100bb/, '600x600bb'),
        duration: Number(item.trackTimeMillis) / 1000 || 0,
        genre: item.primaryGenreName,
        recommended: true,
      }));

    const out = { tracks };
    remember(recommendationCache, cacheKey, out, 1_800_000);
    return res.json(out);
  } catch (err: any) {
    console.error('[Recommendations Error]', err);
    return res.status(503).json({ error: 'Similar songs are temporarily unavailable.' });
  }
}

// ─── Mood Handler ─────────────────────────────────────────────────────────────
export async function handleMood(req: Request, res: Response) {
  const moodId = String(req.query.mood || '').trim();
  const lang = String(req.query.lang || '').trim();

  const mood = MOODS.find((m) => m.id === moodId);
  if (!mood) {
    return res.status(400).json({ error: 'Invalid mood specified.' });
  }

  const cacheKey = `${moodId}::${lang}`;
  const cached = moodCache.get(cacheKey);
  if (cached && cached.until > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const langHint = lang && lang !== 'en' ? LANGUAGE_NAMES[lang] || '' : '';
    const query = langHint ? `${mood.query} ${langHint}` : mood.query;

    const resp = await axios.get('https://api.deezer.com/search/playlist', {
      params: { q: query, limit: '10' },
      timeout: 8000,
    });

    const playlists = (resp.data?.data || [])
      .filter((item: any) => Number.isSafeInteger(item.id) && (item.nb_tracks || 0) >= 10)
      .slice(0, 2);

    const trackLists = await Promise.all(
      playlists.map((pl: any) =>
        axios
          .get(`https://api.deezer.com/playlist/${pl.id}/tracks?limit=40`, { timeout: 8000 })
          .then((r) => r.data?.data || [])
          .catch(() => [])
      )
    );

    const seen = new Set<string>();
    const tracks: any[] = [];
    const maxLen = Math.max(0, ...trackLists.map((l: any[]) => l.length));

    for (let idx = 0; idx < maxLen && tracks.length < 24; idx++) {
      for (const list of trackLists) {
        const item = list[idx];
        if (!item || !item.id || !item.title || !item.artist?.name) continue;
        const key = fold(item.title);
        if (seen.has(key)) continue;
        seen.add(key);
        tracks.push({
          id: `deezer:${item.id}`,
          title: item.title,
          artist: item.artist.name,
          artistId: item.artist.id,
          album: item.album?.title || '',
          artwork: safeHttps(item.album?.cover_xl || item.album?.cover_big),
          duration: Number(item.duration) || 0,
          mood: mood.id,
        });
        if (tracks.length >= 24) break;
      }
    }

    const out = { tracks };
    remember(moodCache, cacheKey, out, 3_600_000);
    return res.json(out);
  } catch (err: any) {
    console.error('[Mood Error]', err);
    return res.status(503).json({ error: 'Mood tracks are temporarily unavailable.' });
  }
}

// ─── Tempo Handler ────────────────────────────────────────────────────────────
export async function handleTempo(req: Request, res: Response) {
  const artist = String(req.query.artist || '').trim();
  const title = String(req.query.title || '').trim();

  if (!artist || !title) {
    return res.status(400).json({ error: 'Valid artist and title are required.' });
  }

  const cacheKey = `${artist}::${title}`.toLowerCase();
  const cached = tempoCache.get(cacheKey);
  if (cached && cached.until > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const resp = await axios.get('https://api.deezer.com/search', {
      params: { q: `artist:"${artist}" track:"${title}"`, limit: '5' },
      timeout: 6000,
    });

    const targetArtist = fold(artist);
    const targetTitle = fold(title);
    const match = (resp.data?.data || []).find(
      (item: any) =>
        item &&
        item.id &&
        fold(item.artist?.name) === targetArtist &&
        fold(item.title).includes(targetTitle)
    );

    let bpm: number | null = null;
    if (match) {
      const trackDetail = await axios.get(`https://api.deezer.com/track/${match.id}`, {
        timeout: 5000,
      });
      const rawBpm = Number(trackDetail.data?.bpm);
      if (rawBpm >= 50 && rawBpm <= 220) {
        bpm = Math.round(rawBpm * 10) / 10;
      }
    }

    const out = { bpm, replays: [] };
    remember(tempoCache, cacheKey, out, 86_400_000); // 24hr cache
    return res.json(out);
  } catch {
    return res.json({ bpm: null, replays: [] });
  }
}

// ─── Secure Groq Whisper Audio Transcription Handler ──────────────────────────
export async function handleTranscribe(req: Request, res: Response) {
  try {
    // 1. Determine active Groq API Key
    // Backend env var GROQ_API_KEY takes precedence for secure server-side execution
    const authHeader = req.headers.authorization || '';
    const clientKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    const apiKey = process.env.GROQ_API_KEY || clientKey;

    if (!apiKey) {
      return res.status(401).json({
        error: 'Groq API Key not configured on backend. Please configure GROQ_API_KEY in Render environment variables.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No audio file provided in request.' });
    }

    const language = (req.body?.language as string) || '';
    const model = (req.body?.model as string) || 'whisper-large-v3';

    // Construct FormData using Node 18+ native Blob & FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], {
      type: req.file.mimetype || 'audio/wav',
    });
    formData.append('file', blob, req.file.originalname || 'audio.wav');
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('timestamp_granularities[]', 'word');
    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      let message = `Groq API returned HTTP ${groqResponse.status}`;
      try {
        const errData: any = await groqResponse.json();
        message = errData?.error?.message || message;
      } catch {
        // ignore
      }
      return res.status(groqResponse.status).json({ error: message });
    }

    const data = await groqResponse.json();
    return res.json(data);
  } catch (err: any) {
    console.error('[Transcribe Error]', err);
    return res.status(500).json({ error: err.message || 'Audio transcription failed on server.' });
  }
}
