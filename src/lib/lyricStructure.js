/**
 * lyricStructure.js
 * High-precision word-level lyrics parser, smart chorus/hook detector,
 * dual-script support, and syllable drill analysis.
 */

import { normalizeLyricText } from './lyrics.js';

/**
 * Approximate syllable count for a word or phrase across English,
 * Latin languages, and phonetic / CJK / Indic scripts.
 * @param {string} text
 * @returns {number}
 */
export function countSyllables(text) {
  if (!text || typeof text !== 'string') return 0;
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return 0;

  // Handle East Asian characters (each char ~ 1 syllable)
  const cjkMatches = cleaned.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g);
  let cjkCount = cjkMatches ? cjkMatches.length : 0;

  // Handle Indic / Devanagari (consonant-vowel syllables)
  // eslint-disable-next-line no-misleading-character-class
  const indicMatches = cleaned.match(/[\u0900-\u097F\u0C80-\u0CFF\u0B80-\u0BFF\u0C00-\u0C7F]/gu);
  let indicCount = indicMatches ? Math.ceil(indicMatches.length * 0.6) : 0;

  // For Latin text: split words and count vowel groups
  const words = cleaned.replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  let latinCount = 0;

  for (const word of words) {
    if (word.length <= 3) {
      latinCount += 1;
      continue;
    }
    // Remove silent 'e' at the end
    let w = word.replace(/(?:[^laeiouy]|ed|es)e$/, '');
    w = w.replace(/^y/, '');
    const vowelMatches = w.match(/[aeiouy]{1,2}/g);
    latinCount += vowelMatches ? Math.max(1, vowelMatches.length) : 1;
  }

  return Math.max(1, latinCount + cjkCount + indicCount);
}

/**
 * Parses enhanced LRC line with inline timestamps `<mm:ss.xx>word` or plain text.
 * @param {string} line
 * @param {number} [_fallbackStart]
 * @returns {{ words: Array<{text: string, start: number, end: number}>, text: string }}
 */
export function parseEnhancedLrcLine(line, _fallbackStart = 0) {
  const wordRegex = /<(\d+):(\d+(?:\.\d+)?)>\s*([^<]+)/g;
  const words = [];
  let match;
  let rawText = '';

  while ((match = wordRegex.exec(line)) !== null) {
    const mins = parseFloat(match[1]);
    const secs = parseFloat(match[2]);
    const wordText = match[3];
    const start = mins * 60 + secs;
    words.push({ text: wordText.trim(), start, end: start + 0.35 });
    rawText += wordText;
  }

  // Adjust ends so each word ends when the next starts
  for (let i = 0; i < words.length; i++) {
    if (i < words.length - 1) {
      words[i].end = Math.max(words[i].start + 0.05, words[i + 1].start);
    }
  }

  if (words.length > 0) {
    return { words, text: rawText.trim() };
  }

  // Plain line fallback
  const cleanLine = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
  return { words: [], text: cleanLine };
}

/**
 * Parses word-level lyrics from various schemas (JSON word arrays, LRC, or raw text).
 * Normalizes all lines into consistent LyricLine structures.
 * @param {Object|string} input
 * @returns {Array<Object>}
 */
export function parseWordLyrics(input) {
  if (!input) return [];

  let rawLines = [];

  if (typeof input === 'string') {
    // Check if it's LRC format
    const lines = input.split(/\r?\n/);
    let autoId = 0;
    for (const raw of lines) {
      const match = raw.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (match) {
        const time = parseFloat(match[1]) * 60 + parseFloat(match[2]);
        const content = match[3];
        const parsed = parseEnhancedLrcLine(content, time);
        rawLines.push({
          id: `line-${autoId++}`,
          time,
          text: parsed.text || content.trim(),
          words: parsed.words.length ? parsed.words : undefined,
        });
      } else if (raw.trim()) {
        rawLines.push({
          id: `line-${autoId++}`,
          time: 0,
          text: raw.trim(),
        });
      }
    }
  } else if (Array.isArray(input)) {
    rawLines = input;
  } else if (input.lines && Array.isArray(input.lines)) {
    rawLines = input.lines;
  } else if (input.plainLyrics) {
    return parseWordLyrics(input.plainLyrics);
  }

  if (!rawLines.length) return [];

  // Sort by time
  const sorted = [...rawLines].sort((a, b) => (a.time || 0) - (b.time || 0));

  // Compute end times and syllables for each line
  const processed = sorted.map((line, idx) => {
    const nextLine = sorted[idx + 1];
    let endTime = line.endTime;

    if (!endTime) {
      if (line.words && line.words.length > 0) {
        endTime = line.words[line.words.length - 1].end;
      } else if (nextLine && Number.isFinite(nextLine.time)) {
        endTime = Math.max(line.time + 0.5, nextLine.time - 0.15);
      } else {
        endTime = line.time + 3.5;
      }
    }

    const duration = Math.max(0.4, endTime - (line.time || 0));
    const syllableCount = countSyllables(line.text);
    const syllablesPerSec = parseFloat((syllableCount / duration).toFixed(1));
    const isFast = syllablesPerSec >= 3.8;

    let difficulty = 'easy';
    if (syllablesPerSec >= 5.5) difficulty = 'drill';
    else if (syllablesPerSec >= 4.0) difficulty = 'fast';
    else if (syllablesPerSec >= 2.8) difficulty = 'medium';

    return {
      id: line.id || `line-${idx}`,
      time: line.time || 0,
      endTime,
      text: line.text || '',
      romanized: line.romanized || line.phonetic || null,
      words: line.words || null,
      syllableCount,
      syllablesPerSec,
      isFast,
      difficulty,
      isChorus: Boolean(line.isChorus),
      isHook: Boolean(line.isHook),
      sectionName: line.sectionName || null,
      targetPitch: line.targetPitch || null,
    };
  });

  return detectLyricSections(processed);
}

/**
 * Smart detection of repeating sections (Choruses, Hooks, Refrains)
 * and generation of one-click jump chips / section bookmarks.
 * @param {Array<Object>} lines
 * @returns {Array<Object>}
 */
export function detectLyricSections(lines) {
  if (!lines || !lines.length) return [];

  // Group line texts to find recurring patterns (choruses)
  const normalizedTexts = lines.map((l) => normalizeLyricText(l.text));
  const counts = new Map();

  for (const text of normalizedTexts) {
    if (text.length > 8) {
      counts.set(text, (counts.get(text) || 0) + 1);
    }
  }

  // Identify lines that appear at least twice as chorus candidate lines
  const repeatingTexts = new Set(
    Array.from(counts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([text]) => text)
  );

  let chorusCounter = 1;
  let verseCounter = 1;
  let currentSectionType = null;
  let currentSectionName = 'Intro';

  // Mark lines with section metadata
  for (let i = 0; i < lines.length; i++) {
    const norm = normalizedTexts[i];
    const isRepeat = repeatingTexts.has(norm);

    if (isRepeat) {
      if (currentSectionType !== 'chorus') {
        currentSectionType = 'chorus';
        currentSectionName = `Chorus ${chorusCounter++}`;
      }
      lines[i].isChorus = true;
      lines[i].sectionName = currentSectionName;
    } else {
      if (currentSectionType === 'chorus' || currentSectionType === null) {
        currentSectionType = 'verse';
        currentSectionName = `Verse ${verseCounter++}`;
      }
      if (!lines[i].sectionName) {
        lines[i].sectionName = currentSectionName;
      }
    }
  }

  return lines;
}

/**
 * Extracts distinct section chips for one-click jump navigation.
 * @param {Array<Object>} lines
 * @returns {Array<{id: string, label: string, type: string, time: number, endTime: number, lineIndices: number[]}>}
 */
export function extractSectionChips(lines) {
  if (!lines || !lines.length) return [];

  const sections = [];
  let current = null;

  lines.forEach((line, index) => {
    const secName = line.sectionName || (line.isChorus ? 'Chorus' : 'Verse');
    if (!current || current.label !== secName) {
      if (current) {
        current.endTime = lines[index - 1]?.endTime || current.time + 10;
        sections.push(current);
      }
      current = {
        id: `sec-${sections.length}-${secName.toLowerCase().replace(/\s+/g, '-')}`,
        label: secName,
        type: line.isChorus ? 'chorus' : 'verse',
        time: line.time,
        endTime: line.endTime,
        lineIndices: [index],
      };
    } else {
      current.lineIndices.push(index);
    }
  });

  if (current) {
    current.endTime = lines[lines.length - 1]?.endTime || current.time + 10;
    sections.push(current);
  }

  return sections;
}

/**
 * Helper to get active line index and active word index for a given playback time.
 * @param {Array<Object>} lines
 * @param {number} time
 * @returns {{ activeLineIndex: number, activeWordIndex: number }}
 */
export function getActiveIndices(lines, time) {
  if (!lines || !lines.length) return { activeLineIndex: -1, activeWordIndex: -1 };

  let activeLineIndex = -1;
  let activeWordIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (time >= line.time && time <= line.endTime + 0.2) {
      activeLineIndex = i;
      break;
    }
    if (line.time <= time) {
      activeLineIndex = i;
    }
  }

  if (activeLineIndex >= 0) {
    const line = lines[activeLineIndex];
    if (line.words && line.words.length > 0) {
      for (let w = 0; w < line.words.length; w++) {
        const word = line.words[w];
        if (time >= word.start && time <= word.end + 0.1) {
          activeWordIndex = w;
          break;
        }
        if (word.start <= time) {
          activeWordIndex = w;
        }
      }
    }
  }

  return { activeLineIndex, activeWordIndex };
}
