import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPracticeHistory,
  deletePracticeSession,
  clearPracticeHistory,
  getStoredVocalRange,
  getDailyPlan,
  saveDailyPlan,
} from '../lib/storage/practiceDb';
import { identifyWeakSections } from '../lib/vocalIntelligence/weaknessAnalyzer';
import { generateRecommendations } from '../lib/vocalIntelligence/recommendationEngine';
import { calculateAdaptiveDifficulty } from '../lib/vocalIntelligence/difficultyEngine';
import { analyzeVocalProgress } from '../lib/vocalIntelligence/progressAnalyzer';
import {
  generateDailyPlan,
  togglePlanTask,
  getTodayDateString,
} from '../lib/vocalIntelligence/practicePlanGenerator';
import { generateCoachInsights } from '../lib/vocalIntelligence/vocalInsights';

export function useVocalIntelligence() {
  const [sessions, setSessions] = useState([]);
  const [vocalRange, setVocalRange] = useState(null);
  const [dailyPlan, setDailyPlan] = useState(null);
  const [manualDifficulty, setManualDifficulty] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load primary data
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const history = await getPracticeHistory();
      setSessions(history || []);

      const range = getStoredVocalRange();
      setVocalRange(range);

      const today = getTodayDateString();
      let plan = await getDailyPlan(today);
      if (!plan) {
        plan = generateDailyPlan(history, range, today);
        await saveDailyPlan(plan);
      }
      setDailyPlan(plan);
    } catch (err) {
      console.warn('[useVocalIntelligence] Failed to refresh intelligence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Derived Intelligence Computations (memoized to prevent re-render thrashing)
  const weakSections = useMemo(() => {
    return identifyWeakSections(sessions, { minAttempts: 2 });
  }, [sessions]);

  const recommendations = useMemo(() => {
    return generateRecommendations(sessions, vocalRange);
  }, [sessions, vocalRange]);

  const difficulty = useMemo(() => {
    return calculateAdaptiveDifficulty(sessions, manualDifficulty);
  }, [sessions, manualDifficulty]);

  const progress = useMemo(() => {
    return analyzeVocalProgress(sessions, vocalRange);
  }, [sessions, vocalRange]);

  const insights = useMemo(() => {
    return generateCoachInsights(sessions, vocalRange);
  }, [sessions, vocalRange]);

  // Actions
  const toggleTask = useCallback(async (taskId) => {
    if (!dailyPlan) return;
    const updated = togglePlanTask(dailyPlan, taskId);
    setDailyPlan(updated);
    await saveDailyPlan(updated);
  }, [dailyPlan]);

  const removeSession = useCallback(async (id) => {
    await deletePracticeSession(id);
    await refresh();
  }, [refresh]);

  const clearHistory = useCallback(async () => {
    await clearPracticeHistory();
    await refresh();
  }, [refresh]);

  return {
    loading,
    sessions,
    vocalRange,
    dailyPlan,
    weakSections,
    recommendations,
    difficulty,
    progress,
    insights,
    refresh,
    toggleTask,
    setManualDifficulty,
    removeSession,
    clearHistory,
  };
}

