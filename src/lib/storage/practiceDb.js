/**
 * practiceDb.js
 * Client-side IndexedDB v2 storage for vocal practice sessions, score history,
 * weak section data, daily practice plans, and user vocal range profiles.
 * 100% private, on-device only, zero cloud tracking.
 */

const DB_NAME = 'swar_practice_db';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_DAILY_PLANS = 'daily_plans';

/**
 * Normalizes any session record (legacy v1 or partial) to ensure backward compatibility.
 * @param {Object} rec
 * @returns {Object}
 */
export function normalizeSessionRecord(rec = {}) {
  return {
    id: rec.id,
    date: rec.date || new Date().toISOString(),
    exerciseType: rec.exerciseType || 'game', // 'game' | 'looper' | 'warmup' | 'range'
    songTitle: rec.songTitle || 'Practice Session',
    artist: rec.artist || '',
    score: typeof rec.score === 'number' ? rec.score : 0,
    grade: rec.grade || 'B',
    pitchAccuracy: typeof rec.pitchAccuracy === 'number' ? rec.pitchAccuracy : 75,
    maxStreak: typeof rec.maxStreak === 'number' ? rec.maxStreak : 0,
    lineScores: Array.isArray(rec.lineScores) ? rec.lineScores : [],
    drillId: rec.drillId || null,
    drillName: rec.drillName || null,
    rootKey: rec.rootKey || null,
    difficultyTier: rec.difficultyTier || 'standard',
    validSampleRatio: typeof rec.validSampleRatio === 'number' ? rec.validSampleRatio : 1.0,
    durationSeconds: typeof rec.durationSeconds === 'number' ? rec.durationSeconds : 0,
  };
}

/**
 * Opens or initializes the IndexedDB database.
 * Handles schema upgrades gracefully without wiping existing records.
 * @returns {Promise<IDBDatabase>}
 */
export function openPracticeDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Create or update sessions store
      let sessionStore;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        sessionStore = db.createObjectStore(STORE_SESSIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        sessionStore.createIndex('date', 'date', { unique: false });
        sessionStore.createIndex('songTitle', 'songTitle', { unique: false });
      } else {
        sessionStore = request.transaction.objectStore(STORE_SESSIONS);
      }

      // Add exerciseType index if upgrading to v2
      if (oldVersion < 2 && !sessionStore.indexNames.contains('exerciseType')) {
        sessionStore.createIndex('exerciseType', 'exerciseType', { unique: false });
      }

      // Create daily_plans store in v2
      if (!db.objectStoreNames.contains(STORE_DAILY_PLANS)) {
        db.createObjectStore(STORE_DAILY_PLANS, { keyPath: 'date' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a completed practice session.
 * @param {Object} session
 * @returns {Promise<number>} Session ID
 */
export async function savePracticeSession(session) {
  const normalized = normalizeSessionRecord({
    ...session,
    date: session.date || new Date().toISOString(),
  });

  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.add(normalized);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try {
      const prev = JSON.parse(localStorage.getItem('swar_practice_history') || '[]');
      const id = Date.now();
      prev.unshift({ ...normalized, id });
      localStorage.setItem('swar_practice_history', JSON.stringify(prev.slice(0, 100)));
      return id;
    } catch {
      return 0;
    }
  }
}

/**
 * Retrieves all saved practice sessions ordered by date descending.
 * Normalizes all legacy records on read.
 * @returns {Promise<Array<Object>>}
 */
export async function getPracticeHistory() {
  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        const raw = req.result || [];
        const normalized = raw.map(normalizeSessionRecord);
        normalized.sort((a, b) => new Date(b.date) - new Date(a.date));
        resolve(normalized);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = JSON.parse(localStorage.getItem('swar_practice_history') || '[]');
      return raw.map(normalizeSessionRecord);
    } catch {
      return [];
    }
  }
}

/**
 * Deletes a single practice session record by ID.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deletePracticeSession(id) {
  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const prev = JSON.parse(localStorage.getItem('swar_practice_history') || '[]');
      const filtered = prev.filter((s) => s.id !== id);
      localStorage.setItem('swar_practice_history', JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Clears all practice history.
 * @returns {Promise<boolean>}
 */
export async function clearPracticeHistory() {
  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS, STORE_DAILY_PLANS], 'readwrite');
      tx.objectStore(STORE_SESSIONS).clear();
      tx.objectStore(STORE_DAILY_PLANS).clear();
      tx.oncomplete = () => {
        localStorage.removeItem('swar_practice_history');
        localStorage.removeItem('swar_daily_plan');
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem('swar_practice_history');
    localStorage.removeItem('swar_daily_plan');
    return true;
  }
}

/**
 * Saves a daily practice plan.
 * @param {Object} plan - { date: 'YYYY-MM-DD', tasks: [...], ... }
 * @returns {Promise<boolean>}
 */
export async function saveDailyPlan(plan) {
  if (!plan || !plan.date) return false;
  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAILY_PLANS, 'readwrite');
      const store = tx.objectStore(STORE_DAILY_PLANS);
      const req = store.put(plan);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.setItem('swar_daily_plan', JSON.stringify(plan));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Retrieves a daily practice plan by date string ('YYYY-MM-DD').
 * @param {string} dateString
 * @returns {Promise<Object | null>}
 */
export async function getDailyPlan(dateString) {
  if (!dateString) return null;
  try {
    const db = await openPracticeDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAILY_PLANS, 'readonly');
      const store = tx.objectStore(STORE_DAILY_PLANS);
      const req = store.get(dateString);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const stored = JSON.parse(localStorage.getItem('swar_daily_plan') || 'null');
      return stored && stored.date === dateString ? stored : null;
    } catch {
      return null;
    }
  }
}

/**
 * Retrieves the stored vocal range profile from localStorage.
 * @returns {Object | null}
 */
export function getStoredVocalRange() {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return null;
    const raw = storage.getItem('swar_vocal_range');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Stores a vocal range profile.
 * @param {Object} profile
 */
export function setStoredVocalRange(profile) {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return;
    storage.setItem('swar_vocal_range', JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}
