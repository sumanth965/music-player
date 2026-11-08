/**
 * weaknessAnalyzer.js
 * Analyzes historical practice sessions to identify recurring difficult vocal lines,
 * high-error pitch registers, and interval transitions.
 * Strictly filters out low microphone signal quality to avoid false positives.
 */

/**
 * Minimum valid attempts required before designating a lyric line as a verified vocal weakness.
 * Prevents flagging single-take microphone glitches or environmental noise as singer weaknesses.
 */
export const MIN_ATTEMPTS_THRESHOLD = 2;

/**
 * Minimum valid audio sample ratio required for a session take to be included in weakness analysis.
 */
export const MIN_SIGNAL_RATIO = 0.4;

/**
 * Checks whether sufficient reliable data exists to perform weakness analysis.
 * @param {Array<Object>} sessions
 * @returns {boolean}
 */
export function hasSufficientPracticeData(sessions = []) {
  if (!Array.isArray(sessions)) return false;
  const valid = sessions.filter((s) => (s.validSampleRatio ?? 1.0) >= MIN_SIGNAL_RATIO && (s.lineScores?.length > 0 || s.score > 0));
  return valid.length >= 2;
}

/**
 * Analyzes practice session lineScores across songs to detect recurring weak lines.
 *
 * @param {Array<Object>} sessions - Raw or normalized practice session records
 * @param {Object} [options]
 * @param {string} [options.songTitle] - Filter by specific song title
 * @param {number} [options.minAttempts=2] - Minimum line attempts required
 * @returns {Array<Object>} Ranked weak sections from highest difficulty to lowest
 */
export function identifyWeakSections(sessions = [], options = {}) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const minAttempts = options.minAttempts || MIN_ATTEMPTS_THRESHOLD;
  const targetSong = options.songTitle ? options.songTitle.trim().toLowerCase() : null;

  // Filter out low microphone quality takes
  const reliableSessions = sessions.filter((s) => {
    const isQuality = (s.validSampleRatio ?? 1.0) >= MIN_SIGNAL_RATIO;
    const matchesSong = targetSong ? (s.songTitle || '').trim().toLowerCase() === targetSong : true;
    return isQuality && matchesSong && Array.isArray(s.lineScores) && s.lineScores.length > 0;
  });

  if (reliableSessions.length === 0) return [];

  // Group performance by song and lineIndex
  const lineStatsMap = new Map();

  for (const session of reliableSessions) {
    const songKey = (session.songTitle || 'Unknown').trim();
    const artist = session.artist || '';

    for (const line of session.lineScores) {
      if (typeof line.lineIndex !== 'number') continue;

      const key = `${songKey}:::${line.lineIndex}`;
      if (!lineStatsMap.has(key)) {
        lineStatsMap.set(key, {
          songTitle: songKey,
          artist,
          lineIndex: line.lineIndex,
          text: line.text || `Line ${line.lineIndex + 1}`,
          attempts: 0,
          missCount: 0,
          totalCentsDiff: 0,
          perfectCount: 0,
        });
      }

      const stat = lineStatsMap.get(key);
      stat.attempts += 1;
      const cents = typeof line.centsDiff === 'number' ? line.centsDiff : 50;
      stat.totalCentsDiff += cents;

      if (line.status === 'miss' || cents > 65) {
        stat.missCount += 1;
      } else if (line.status === 'perfect' || cents <= 35) {
        stat.perfectCount += 1;
      }
    }
  }

  // Filter by minimum attempts and rank by severity
  const weakSections = [];

  for (const stat of lineStatsMap.values()) {
    if (stat.attempts < minAttempts) continue;

    const missRate = stat.missCount / stat.attempts;
    const avgCentsDiff = Math.round(stat.totalCentsDiff / stat.attempts);

    // If missRate is under 35% and average deviation is under 45 cents, this is not a weak section
    if (missRate < 0.35 && avgCentsDiff < 45) continue;

    // Severity score: 0 to 100
    const severity = Math.min(
      100,
      Math.round((missRate * 60) + (Math.min(100, avgCentsDiff) * 0.4))
    );

    let reason = 'Frequent pitch deviation';
    if (missRate >= 0.75) {
      reason = `Missed target pitch in ${Math.round(missRate * 100)}% of attempts (${stat.attempts} takes)`;
    } else if (avgCentsDiff >= 65) {
      reason = `Consistent intonation sag (avg ${avgCentsDiff} cents off)`;
    } else {
      reason = `Pitch instability across ${stat.attempts} repeated attempts`;
    }

    weakSections.push({
      songTitle: stat.songTitle,
      artist: stat.artist,
      lineIndex: stat.lineIndex,
      text: stat.text,
      attempts: stat.attempts,
      missCount: stat.missCount,
      missRate: parseFloat(missRate.toFixed(2)),
      avgCentsDiff,
      severity,
      reason,
    });
  }

  // Sort by highest severity first
  weakSections.sort((a, b) => b.severity - a.severity);
  return weakSections;
}

/**
 * Analyzes pitch accuracy across lower, middle, and upper vocal registers.
 * Helps identify register strain without inventing unmeasured metrics.
 *
 * @param {Array<Object>} sessions
 * @param {Object} [vocalRange] - User's tested vocal range profile
 * @returns {Object} Register breakdown with accuracy percentages
 */
export function analyzeRegisterAccuracy(sessions = [], vocalRange = null) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { low: null, mid: null, high: null, totalEvaluated: 0 };
  }

  let lowAccSum = 0, lowCount = 0;
  let midAccSum = 0, midCount = 0;
  let highAccSum = 0, highCount = 0;

  for (const session of sessions) {
    if (!Array.isArray(session.lineScores)) continue;

    for (const line of session.lineScores) {
      if (typeof line.centsDiff !== 'number') continue;
      const accuracy = Math.max(0, 100 - line.centsDiff);
      const target = typeof line.targetMidi === 'number' ? line.targetMidi : 60;

      // Group registers by MIDI:
      // Low: < 55 (below G3)
      // Mid: 55 to 67 (G3 to G4)
      // High: > 67 (above G4)
      if (target < 55) {
        lowAccSum += accuracy;
        lowCount++;
      } else if (target <= 67) {
        midAccSum += accuracy;
        midCount++;
      } else {
        highAccSum += accuracy;
        highCount++;
      }
    }
  }

  return {
    low: lowCount >= 3 ? Math.round(lowAccSum / lowCount) : null,
    mid: midCount >= 3 ? Math.round(midAccSum / midCount) : null,
    high: highCount >= 3 ? Math.round(highAccSum / highCount) : null,
    totalEvaluated: lowCount + midCount + highCount,
  };
}

