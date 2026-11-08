/**
 * vocalMelody.js
 * Melodic contour generation, musical scale mapping, and reference vocal pitch targets.
 * Replaces arbitrary pseudo-random hashing with musically coherent pitch contours
 * following stepwise diatonic intervals, cadence resolutions, and phrase curves.
 */

// Common diatonic scale intervals (Major scale semitone steps from root)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
// Pentatonic scale intervals (Universal vocal melody backbone)
const PENTATONIC_SCALE_INTERVALS = [0, 2, 4, 7, 9];

/**
 * Standard pitch roots in MIDI note numbers (octave 4)
 */
export const ROOT_MIDI_MAP = {
  C: 60,
  'C#': 61,
  Db: 61,
  D: 62,
  'D#': 63,
  Eb: 63,
  E: 64,
  F: 65,
  'F#': 66,
  Gb: 66,
  G: 67,
  'G#': 68,
  Ab: 68,
  A: 69,
  'A#': 70,
  Bb: 70,
  B: 71,
};

/**
 * Maps a scale degree to an absolute MIDI note number within a comfortable vocal range.
 * @param {number} degree - 0-based scale degree
 * @param {number} rootMidi - Root MIDI note (default 60 = C4)
 * @param {boolean} [pentatonic=true] - Use pentatonic intervals
 * @returns {number} MIDI note number
 */
export function scaleDegreeToMidi(degree, rootMidi = 60, pentatonic = true) {
  const intervals = pentatonic ? PENTATONIC_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  const numSteps = intervals.length;

  const octaveShift = Math.floor(degree / numSteps);
  const normalizedDegree = ((degree % numSteps) + numSteps) % numSteps;
  const semitoneOffset = intervals[normalizedDegree] + (octaveShift * 12);

  return rootMidi + semitoneOffset;
}

/**
 * Generates a musical reference vocal melody contour for a lyric line.
 * If line has an explicit targetPitch or pitch array, that is preferred.
 * Otherwise, generates a stepwise melodic curve (antecedent -> climax -> cadence).
 *
 * @param {Object} line - Parsed lyric line with text, words, isChorus, time, endTime
 * @param {number} lineIndex - Index of line in song
 * @param {number} totalLines - Total number of lines in song
 * @param {Object} [options]
 * @param {number} [options.rootMidi=60] - Base root MIDI note
 * @returns {number} Target MIDI note for line/phrase anchor
 */
export function getLineMelodyTarget(line, lineIndex = 0, totalLines = 1, options = {}) {
  if (!line) return 60;

  // 1. Explicit pitch metadata from song/karaoke source
  if (typeof line.targetPitch === 'number' && line.targetPitch > 0) {
    return line.targetPitch;
  }

  const root = options.rootMidi || 60; // Default C4

  // 2. Phrase position in 4-bar phrase structure (0, 1, 2, 3)
  const phrasePos = lineIndex % 4;

  // Chorus lifts melody higher (typically a 3rd or 5th above verse root)
  const chorusLift = line.isChorus ? 4 : 0;

  // Melodic contour pattern across 4-line phrase:
  // Line 0 (Call/Onset): Root or 2nd (e.g. scale degree 0)
  // Line 1 (Development): Step up to 3rd or 4th (scale degree 1 or 2)
  // Line 2 (Climax/Tension): Highest melodic arch (scale degree 3 or 4)
  // Line 3 (Cadence/Resolution): Resolves back to Root (scale degree 0)
  const melodicContour = [0, 2, 3, 0];
  const scaleDegree = (melodicContour[phrasePos] ?? 0) + (line.isChorus ? 2 : 0);

  const midi = scaleDegreeToMidi(scaleDegree, root + chorusLift, true);

  // Clamp within realistic human vocal practice range (C3 = 48 to C6 = 84)
  return Math.max(48, Math.min(84, midi));
}

/**
 * Extracts note targets for every word in a line, supporting smooth vocal slides.
 * @param {Object} line
 * @param {number} lineIndex
 * @param {Object} [options]
 * @returns {Array<{ word: string, time: number, endTime: number, midi: number }>}
 */
export function getWordMelodyTargets(line, lineIndex = 0, options = {}) {
  if (!line) return [];
  const lineTarget = getLineMelodyTarget(line, lineIndex, 1, options);

  if (!line.words || line.words.length === 0) {
    return [{
      word: line.text || '',
      time: line.time || 0,
      endTime: line.endTime || 5,
      midi: lineTarget,
    }];
  }

  const totalWords = line.words.length;
  return line.words.map((w, idx) => {
    // If word has explicit pitch from format (e.g. KuGou KRC pitch tags)
    if (typeof w.pitch === 'number' && w.pitch > 0) {
      return { ...w, midi: w.pitch };
    }

    // Melodic inflection across words: slight rise in middle of phrase, settling at end
    const progress = totalWords > 1 ? idx / (totalWords - 1) : 0;
    const inflection = Math.sin(progress * Math.PI) > 0.7 ? 2 : 0; // Gentle arch (+2 semitones at climax)

    return {
      word: w.text || w.word || '',
      time: w.time,
      endTime: w.endTime,
      midi: lineTarget + inflection,
    };
  });
}

