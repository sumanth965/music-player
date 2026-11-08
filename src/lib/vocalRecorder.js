/**
 * vocalRecorder.js
 * Browser-native MediaRecorder helpers for capturing user vocal takes,
 * formatting audio blobs, and synchronizing take playback.
 */

/**
 * Detects the highest fidelity audio MIME type supported by the browser MediaRecorder.
 * @returns {string | null}
 */
export function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

/**
 * Calculates audio duration in seconds from chunk sizes and bitrate estimates,
 * or formats timestamp for UI display (e.g. 75s -> "01:15").
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatAudioDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Creates a unique safe filename for saving the vocal practice take.
 * @param {string} songTitle
 * @param {string} ext
 * @returns {string}
 */
export function getTakeFilename(songTitle = 'vocal-take', ext = 'webm') {
  const sanitized = (songTitle || 'take')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  return `swar_${sanitized}_${dateStr}.${ext}`;
}

