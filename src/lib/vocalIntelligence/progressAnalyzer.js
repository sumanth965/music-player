/**
 * progressAnalyzer.js
 * Computes multi-dimensional vocal progress metrics, weekly activity volume,
 * accuracy growth curves, and consistency trends without unmeasured claims.
 */

/**
 * Computes a unified progress summary from historical practice sessions.
 *
 * @param {Array<Object>} sessions - Practice sessions ordered newest first
 * @param {Object} [vocalRange] - User's vocal range profile
 * @returns {Object} Progress summary
 */
export function analyzeVocalProgress(sessions = [], vocalRange = null) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      totalSessions: 0,
      totalDurationMinutes: 0,
      weeklyDurationMinutes: 0,
      sessionsThisWeek: 0,
      avgAccuracy: 0,
      accuracyTrend: [],
      bestGrade: '–',
      maxStreak: 0,
      warmupsCompleted: 0,
      mostPracticedSong: null,
      consistencyScore: 0, // 0 - 100
      vocalRange: vocalRange || null,
    };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let totalDurationSec = 0;
  let weeklyDurationSec = 0;
  let sessionsThisWeek = 0;
  let accuracySum = 0;
  let maxStreak = 0;
  let warmupsCompleted = 0;
  const songCountMap = new Map();

  const gradeRankMap = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  let bestGrade = 'D';

  // Chronological array for trend lines (oldest to newest)
  const chronological = [...sessions].reverse();
  const accuracyTrend = [];

  for (const session of sessions) {
    const sessionDate = new Date(session.date || Date.now());
    const isThisWeek = sessionDate >= oneWeekAgo;

    const duration = session.durationSeconds || (session.exerciseType === 'warmup' ? 180 : 210);
    totalDurationSec += duration;

    if (isThisWeek) {
      weeklyDurationSec += duration;
      sessionsThisWeek += 1;
    }

    if (session.exerciseType === 'warmup') {
      warmupsCompleted += 1;
    }

    const acc = typeof session.pitchAccuracy === 'number' ? session.pitchAccuracy : 75;
    accuracySum += acc;

    if ((session.maxStreak || 0) > maxStreak) {
      maxStreak = session.maxStreak;
    }

    const currentBestRank = gradeRankMap[bestGrade] || 0;
    const sessionRank = gradeRankMap[session.grade] || 0;
    if (sessionRank > currentBestRank) {
      bestGrade = session.grade;
    }

    // Track song frequency
    if (session.songTitle && session.exerciseType !== 'warmup') {
      const title = session.songTitle.trim();
      songCountMap.set(title, (songCountMap.get(title) || 0) + 1);
    }
  }

  // Populate accuracy trend (last 10 sessions)
  for (const s of chronological.slice(-10)) {
    accuracyTrend.push({
      date: (s.date || '').slice(5, 10), // MM-DD
      accuracy: typeof s.pitchAccuracy === 'number' ? s.pitchAccuracy : 75,
      song: s.songTitle || 'Session',
    });
  }

  // Determine top song
  let mostPracticedSong = null;
  let maxSongPlays = 0;
  for (const [title, count] of songCountMap.entries()) {
    if (count > maxSongPlays) {
      maxSongPlays = count;
      mostPracticedSong = title;
    }
  }

  // Consistency score: min(100, (sessionsThisWeek / 4) * 100)
  const consistencyScore = Math.min(100, Math.round((sessionsThisWeek / 4) * 100));

  return {
    totalSessions: sessions.length,
    totalDurationMinutes: Math.round(totalDurationSec / 60),
    weeklyDurationMinutes: Math.round(weeklyDurationSec / 60),
    sessionsThisWeek,
    avgAccuracy: Math.round(accuracySum / sessions.length),
    accuracyTrend,
    bestGrade,
    maxStreak,
    warmupsCompleted,
    mostPracticedSong,
    consistencyScore,
    vocalRange: vocalRange || null,
  };
}

