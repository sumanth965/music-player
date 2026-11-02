/**
 * audioTranscription.js
 * Transcribes uploaded song audio into text and synchronized word-level lyrics.
 * Uses Groq Whisper (whisper-large-v3) with fallback to local LyricSense backend (port 8000).
 */

const DEFAULT_GROQ_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GROQ_API_KEY) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_GROQ_API_KEY) ||
  '';
const LOCAL_BACKEND_URL = 'http://localhost:8000';

/**
 * Gets active Groq API Key from localStorage or default.
 */
export function getGroqApiKey() {
  try {
    return (
      (typeof localStorage !== 'undefined' && localStorage.getItem('swar_groq_api_key')) ||
      DEFAULT_GROQ_KEY
    );
  } catch {
    return DEFAULT_GROQ_KEY;
  }
}

/**
 * Saves a custom Groq API Key to localStorage.
 */
export function setGroqApiKey(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (key && key.trim()) {
        localStorage.setItem('swar_groq_api_key', key.trim());
      } else {
        localStorage.removeItem('swar_groq_api_key');
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Checks if the local LyricSense backend is running on port 8000.
 */
export async function checkLocalBackend() {
  try {
    const isExplicitlyEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('swar_use_local_backend') === 'true';
    if (!isExplicitlyEnabled) return false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Converts an AudioBuffer into a standard 16-bit PCM WAV Blob (16kHz mono).
 * Ideal for speech and Whisper transcription models.
 */
export function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  // Mix down to mono
  let samples;
  if (numChannels === 1) {
    samples = buffer.getChannelData(0);
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    samples = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      samples[i] = (left[i] + right[i]) * 0.5;
    }
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = 1 * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // Write WAV Header
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count (1)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Downsamples audio file to 16kHz mono WAV if it exceeds maxBytes.
 */
export async function optimizeAudioForTranscription(file, maxBytes = 24 * 1024 * 1024) {
  if (file.size <= maxBytes) {
    return file;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return file;

    const audioCtx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    // Render 16kHz mono
    const targetSampleRate = 16000;
    const duration = decoded.duration;
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(1, Math.ceil(duration * targetSampleRate), targetSampleRate);

    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWavBlob(rendered);
    return new File([wavBlob], `${file.name.replace(/\.[^.]+$/, '')}-16k.wav`, {
      type: 'audio/wav',
    });
  } catch (err) {
    console.warn('[AudioTranscription] Downsampling skipped:', err);
    return file;
  }
}

/**
 * Transcribes audio file using Groq Whisper or Local LyricSense backend.
 * @param {File|Blob} file
 * @param {Object} [options]
 * @param {string} [options.language]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.onProgress]
 * @returns {Promise<Object>}
 */
export async function transcribeSongAudio(file, options = {}) {
  if (!file) throw new Error('No audio file provided for transcription.');

  const { language, signal, onProgress } = options;
  onProgress?.('Preparing audio file...');

  // Check if local LyricSense backend is active
  const hasLocal = await checkLocalBackend();

  if (hasLocal) {
    onProgress?.('Transcribing via local LyricSense engine...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (language && language !== 'auto') formData.append('language', language);
      formData.append('enable_cloud', 'true');
      formData.append('separate_vocals', 'off');

      const res = await fetch(`${LOCAL_BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (res.ok) {
        const json = await res.json();
        return formatTranscriptionResult(json, 'local');
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[AudioTranscription] Local backend failed, falling back to Groq Cloud:', err);
    }
  }

  // Cloud transcription via Groq whisper-large-v3
  onProgress?.('Transcribing with Groq AI Whisper...');
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API Key not configured. Please add an API key in settings.');
  }

  const uploadFile = await optimizeAudioForTranscription(file);

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('timestamp_granularities[]', 'word');
  if (language && language !== 'auto') {
    formData.append('language', language);
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal,
  });

  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error?.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(`AI Audio Transcription failed: ${errorMsg}`);
  }

  const data = await res.json();
  return formatTranscriptionResult(data, 'groq');
}

/**
 * Normalizes transcription response into standard Swar Music Player lyric lines and text transcript.
 */
export function formatTranscriptionResult(data, engine = 'groq') {
  const rawText = (data.text || data.transcript || '').trim();
  const segments = data.segments || [];
  const words = data.words || [];

  const lines = [];

  if (segments.length > 0) {
    let wordIndex = 0;
    const allWords = words
      .map((w) => {
        const start = Number(w.start ?? 0) || 0;
        const end = Math.max(start + 0.05, Number(w.end ?? start + 0.2) || (start + 0.2));
        return {
          text: (w.word || '').trim(),
          start,
          end,
        };
      })
      .filter((w) => Boolean(w.text));

    segments.forEach((seg, sIdx) => {
      const segStart = Number(seg.start || 0);
      const segEnd = Number(seg.end || segStart + 2);
      const segText = (seg.text || '').trim();
      if (!segText) return;

      // Extract matching words for this segment
      const segWords = [];
      while (wordIndex < allWords.length) {
        const w = allWords[wordIndex];
        if (w.start <= segEnd + 0.15) {
          segWords.push(w);
          wordIndex++;
        } else {
          break;
        }
      }

      lines.push({
        id: `line-${sIdx}`,
        time: segStart,
        endTime: segEnd,
        text: segText,
        words: segWords.length > 0 ? segWords : undefined,
      });
    });
  } else if (rawText) {
    // If no segments returned, break text into lines
    const sentences = rawText.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const duration = Number(data.duration || 60);
    const step = duration / Math.max(1, sentences.length);

    sentences.forEach((s, idx) => {
      lines.push({
        id: `line-${idx}`,
        time: idx * step,
        endTime: (idx + 1) * step,
        text: s.trim(),
      });
    });
  }

  return {
    status: 'completed',
    transcript: rawText,
    lines,
    sync: lines.some((l) => l.words && l.words.length > 0) ? 'word' : 'line',
    language: data.language || 'English',
    duration: Number(data.duration || 0),
    engine,
  };
}
