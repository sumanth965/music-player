import { rankForTaste } from './listening';
import { buildApiUrl } from './api.js';
import { FALLBACK_MOOD_TRACKS } from '../../shared/mood-fallbacks.js';

export function normalizeTrack(item) {
  return { id: String(item.id || item.trackId), title: item.title || item.trackName || 'Untitled', artist: item.artist || item.artistName || 'Unknown artist', album: item.album || item.collectionName || '', artwork: (item.artwork || item.artworkUrl100 || '').replace(/100x100bb/, '600x600bb'), duration: item.duration ?? (item.trackTimeMillis || 0) / 1000, previewUrl: item.previewUrl, videoId: item.videoId, source: item.source, localUrl: item.localUrl, artistId: item.artistId, genre: item.genre || item.primaryGenreName, recommended: item.recommended === true, recommendationReason: item.recommendationReason, lyrics: item.lyrics || null };
}

// Real catalogue snapshot with word-level teleprompter & dual-script demo lyrics
const snapshot =[
  {
    "trackId": 1499378607,
    "trackName": "Blinding Lights",
    "artistName": "The Weeknd",
    "collectionName": "After Hours",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/100x100bb.jpg",
    "trackTimeMillis": 200046,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/19/d6/60/19d660ff-e3a9-8377-15a3-ce4b28e89cac/mzaf_18422426156481158187.plus.aac.p.m4a",
    "lyrics": {
      "sync": "rich",
      "lines": [
        {
          "time": 2.0,
          "text": "I've been on my own for long enough",
          "words": [
            { "text": "I've", "start": 2.0, "end": 2.4 },
            { "text": "been", "start": 2.4, "end": 2.8 },
            { "text": "on", "start": 2.8, "end": 3.1 },
            { "text": "my", "start": 3.1, "end": 3.4 },
            { "text": "own", "start": 3.4, "end": 3.9 },
            { "text": "for", "start": 3.9, "end": 4.2 },
            { "text": "long", "start": 4.2, "end": 4.7 },
            { "text": "enough", "start": 4.7, "end": 5.5 }
          ]
        },
        {
          "time": 5.8,
          "text": "Maybe you can show me how to love, maybe",
          "words": [
            { "text": "Maybe", "start": 5.8, "end": 6.3 },
            { "text": "you", "start": 6.3, "end": 6.6 },
            { "text": "can", "start": 6.6, "end": 6.9 },
            { "text": "show", "start": 6.9, "end": 7.4 },
            { "text": "me", "start": 7.4, "end": 7.7 },
            { "text": "how", "start": 7.7, "end": 8.0 },
            { "text": "to", "start": 8.0, "end": 8.3 },
            { "text": "love,", "start": 8.3, "end": 8.9 },
            { "text": "maybe", "start": 8.9, "end": 9.8 }
          ]
        },
        {
          "time": 10.2,
          "text": "I said, ooh, I'm blinded by the lights",
          "isChorus": true,
          "words": [
            { "text": "I", "start": 10.2, "end": 10.6 },
            { "text": "said,", "start": 10.6, "end": 11.0 },
            { "text": "ooh,", "start": 11.0, "end": 11.8 },
            { "text": "I'm", "start": 11.8, "end": 12.2 },
            { "text": "blinded", "start": 12.2, "end": 12.9 },
            { "text": "by", "start": 12.9, "end": 13.2 },
            { "text": "the", "start": 13.2, "end": 13.5 },
            { "text": "lights", "start": 13.5, "end": 14.5 }
          ]
        },
        {
          "time": 14.8,
          "text": "No, I can't sleep until I feel your touch",
          "isChorus": true,
          "words": [
            { "text": "No,", "start": 14.8, "end": 15.3 },
            { "text": "I", "start": 15.3, "end": 15.6 },
            { "text": "can't", "start": 15.6, "end": 16.1 },
            { "text": "sleep", "start": 16.1, "end": 16.7 },
            { "text": "until", "start": 16.7, "end": 17.2 },
            { "text": "I", "start": 17.2, "end": 17.5 },
            { "text": "feel", "start": 17.5, "end": 18.0 },
            { "text": "your", "start": 18.0, "end": 18.4 },
            { "text": "touch", "start": 18.4, "end": 19.4 }
          ]
        }
      ]
    }
  },
  {
    "trackId": 1640410315,
    "trackName": "Overdose",
    "artistName": "natori",
    "collectionName": "Overdose - Single",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/63/fb/14/63fb149b-4b27-ac16-3029-e815083e16e2/196925612890.jpg/100x100bb.jpg",
    "trackTimeMillis": 197094,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0a/8c/19/0a8c196b-5257-d55a-5f69-723ce7fe2355/mzaf_794029774251610782.plus.aac.p.m4a",
    "lyrics": {
      "sync": "rich",
      "lines": [
        {
          "time": 2.5,
          "text": "本当は分かっていたの",
          "romanized": "Hontou wa wakatte ita no",
          "words": [
            { "text": "本当は", "start": 2.5, "end": 3.4 },
            { "text": "分かって", "start": 3.4, "end": 4.2 },
            { "text": "いたの", "start": 4.2, "end": 5.1 }
          ]
        },
        {
          "time": 5.3,
          "text": "二人の時間は戻らないと",
          "romanized": "Futari no jikan wa modoranai to",
          "words": [
            { "text": "二人の", "start": 5.3, "end": 6.2 },
            { "text": "時間は", "start": 6.2, "end": 7.1 },
            { "text": "戻らないと", "start": 7.1, "end": 8.3 }
          ]
        },
        {
          "time": 8.6,
          "text": "Overdose 意味と目眩を呑み込んで",
          "romanized": "Overdose imi to memai o nomikonde",
          "isChorus": true,
          "words": [
            { "text": "Overdose", "start": 8.6, "end": 9.5 },
            { "text": "意味と", "start": 9.5, "end": 10.3 },
            { "text": "目眩を", "start": 10.3, "end": 11.1 },
            { "text": "呑み込んで", "start": 11.1, "end": 12.6 }
          ]
        },
        {
          "time": 12.9,
          "text": "Overdose 意味と目眩を呑み込んで",
          "romanized": "Overdose imi to memai o nomikonde",
          "isChorus": true,
          "words": [
            { "text": "Overdose", "start": 12.9, "end": 13.8 },
            { "text": "意味と", "start": 13.8, "end": 14.6 },
            { "text": "目眩を", "start": 14.6, "end": 15.4 },
            { "text": "呑み込んで", "start": 15.4, "end": 16.9 }
          ]
        }
      ]
    }
  },
  {
    "trackId": 1776748883,
    "trackName": "Glimpse of Us",
    "artistName": "Joji",
    "collectionName": "SMITHEREENS",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d0/2a/43/d02a433a-3ab8-9a94-b07d-1dc599b64966/93624864387.jpg/100x100bb.jpg",
    "trackTimeMillis": 233453,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0c/53/c2/0c53c240-300a-5ddf-fc86-3a54e1b73a78/mzaf_13555682862214742934.plus.aac.p.m4a"
  },
  {
    "trackId": 1714502827,
    "trackName": "Houdini",
    "artistName": "Dua Lipa",
    "collectionName": "Houdini - Single",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/dd/af/ea/ddafeab5-797a-5b6f-7735-f96c537b45e0/5054197894091.jpg/100x100bb.jpg",
    "trackTimeMillis": 185918,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2c/da/b5/2cdab5c6-04a8-5231-c697-00101e876479/mzaf_5586859405346659517.plus.aac.p.m4a"
  },
  {
    "trackId": 1640410315,
    "trackName": "Overdose",
    "artistName": "natori",
    "collectionName": "Overdose - Single",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/63/fb/14/63fb149b-4b27-ac16-3029-e815083e16e2/196925612890.jpg/100x100bb.jpg",
    "trackTimeMillis": 197094,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/0a/8c/19/0a8c196b-5257-d55a-5f69-723ce7fe2355/mzaf_794029774251610782.plus.aac.p.m4a"
  },
  {
    "trackId": 1293230534,
    "trackName": "How Long",
    "artistName": "Charlie Puth",
    "collectionName": "Voicenotes",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/a8/e2/1b/a8e21b3b-9c8d-2974-2318-6bcd4c9d2370/075679884336.jpg/100x100bb.jpg",
    "trackTimeMillis": 200853,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/8f/69/3e/8f693e25-8042-7e76-d0bb-bf181c5256f2/mzaf_3053047544468175536.plus.aac.p.m4a"
  },
  {
    "trackId": 1745005389,
    "trackName": "Omakase",
    "artistName": "ATARASHII GAKKO!",
    "collectionName": "AG! Calling",
    "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6d/c4/fa/6dc4fae3-ad12-7319-2c1e-5f49e6bf52aa/198588003725.jpg/100x100bb.jpg",
    "trackTimeMillis": 165960,
    "previewUrl": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/a0/9f/26/a09f265e-0cdf-4f2b-0776-2841813bc7f7/mzaf_6917730569441359558.plus.aac.p.m4a"
  }
]
;
export const SEED_TRACKS = snapshot.map(normalizeTrack);
export const videoToTrack = video => ({ id: `yt:${video.videoId}`, videoId: video.videoId, title: video.title, artist: video.artist, album: '', artwork: video.artwork, duration: video.duration, source: 'video', views: video.views });

// Small in-memory caches make switching search tabs and reopening pages instant.
const searchCache = new Map();
const collectionCache = new Map();
const remember = (map, key, value) => { if (map.size >= 30) map.delete(map.keys().next().value); map.set(key, value); return value; };

export async function searchCatalog(query, type = 'all', signal) {
  const term = query.trim();
  if (!term) return { top: null, songs: [], videos: [], albums: [], artists: [], playlists: [] };
  const key = `${type}\u0000${term.toLowerCase()}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const response = await fetch(buildApiUrl('/api/search', { term, type }), { signal });
  if (!response.ok) throw new Error('The music catalogue is unavailable.');
  const data = await response.json();
  return remember(searchCache, key, {
    top: data.top || null,
    songs: (Array.isArray(data.results) ? data.results : []).filter(item => item?.trackId && item.trackName).map(normalizeTrack),
    videos: (Array.isArray(data.videos) ? data.videos : []).filter(item => item?.videoId).map(videoToTrack),
    albums: Array.isArray(data.albums) ? data.albums : [],
    artists: Array.isArray(data.artists) ? data.artists : [],
    playlists: Array.isArray(data.playlists) ? data.playlists : [],
  });
}

export async function searchTracks(query, signal) {
  return (await searchCatalog(query, 'songs', signal)).songs;
}

export async function getCollection(type, id, signal) {
  const key = `${type}:${id}`;
  if (collectionCache.has(key)) return collectionCache.get(key);
  const response = await fetch(buildApiUrl('/api/collection', { type, id: String(id) }), { signal });
  if (!response.ok) throw new Error('This collection could not be opened.');
  const data = await response.json();
  return remember(collectionCache, key, { ...data, tracks: (Array.isArray(data.tracks) ? data.tracks : []).filter(item => item?.id && item.title).map(normalizeTrack) });
}
export async function getFeaturedTracks(signal) {
  signal?.throwIfAborted();
  return SEED_TRACKS;
}

export async function getSimilarTracks(track, signal, { lang } = {}) {
  if (!track?.artist || !track?.title || track.localUrl) return [];
  const params = { artist: track.artist, title: track.title };
  if (track.album) params.album = track.album;
  if (track.genre) params.genre = String(track.genre).slice(0, 60);
  if (track.duration > 0) params.duration = String(Math.round(track.duration));
  if (lang) params.lang = lang;
  const response = await fetch(buildApiUrl('/api/recommendations', params), { signal });
  if (!response.ok) throw new Error('Similar songs are temporarily unavailable.');
  const data = await response.json();
  return rankForTaste((Array.isArray(data.tracks) ? data.tracks : []).filter(item => item.id && item.title && item.artist).map(item => ({ ...normalizeTrack(item), lyricsAvailable: item.lyricsAvailable })));
}

const moodCache = new Map();
// Songs for a home mood chip, in the listener's language when known, ranked by taste.
export async function getMoodTracks(mood, signal, { lang } = {}) {
  const key = `${mood}:${lang || ''}`;
  if (!moodCache.has(key)) {
    const params = lang ? { mood, lang } : { mood };
    try {
      const response = await fetch(buildApiUrl('/api/mood', params), { signal });
      if (!response.ok) throw new Error('Failed to fetch mood');
      const data = await response.json();
      const tracks = (Array.isArray(data.tracks) ? data.tracks : []).filter(item => item?.id && item.title && item.artist).map(normalizeTrack);
      if (tracks.length >= 4) {
        remember(moodCache, key, tracks);
      } else {
        const fallback = (FALLBACK_MOOD_TRACKS[mood] || []).map(normalizeTrack);
        remember(moodCache, key, fallback.length > 0 ? fallback : tracks);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      const fallback = (FALLBACK_MOOD_TRACKS[mood] || []).map(normalizeTrack);
      remember(moodCache, key, fallback);
    }
  }
  return rankForTaste(moodCache.get(key) || []);
}

// Catalogue tempo for online DJ blends; null when the catalogue does not know it.
export async function getTrackTempo(track, signal) {
  return (await getTrackAnalysis(track, null, signal)).bpm;
}

// Catalogue tempo plus, for the exact video playing, YouTube's "Most replayed" markers.
export async function getTrackAnalysis(track, videoId, signal) {
  const params = { artist: track.artist, title: track.title, ...(videoId ? { video: videoId } : {}) };
  const response = await fetch(buildApiUrl('/api/tempo', params), { signal });
  const body = await response.json().catch(() => ({}));
  const replays = Array.isArray(body.replays) ? body.replays : [];
  if (!response.ok && !replays.length) throw new Error('Tempo metadata is unavailable.');
  return { bpm: Number.isFinite(body.bpm) && body.bpm > 0 ? body.bpm : null, replays };
}
