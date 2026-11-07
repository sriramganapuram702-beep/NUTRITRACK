'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  HelpCircle,
  Sparkles,
  Flame,
  Droplets,
  Footprints,
  Edit3,
  Cookie,
  Apple,
} from 'lucide-react';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';
import { DailyGoalBreakdown, DailyRemarks } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

interface DailyAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  userId?: string;
  isSubmitted: boolean;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
    water: number;
    steps: number;
    discretionaryCount: number;
  };
  targets: {
    calorieTarget: number;
    proteinTarget: number;
    carbTarget: number;
    fatTarget: number;
    fibreTarget: number;
    waterTarget: number;
    stepTarget: number;
  };
  breakdown: DailyGoalBreakdown;
  remarks: DailyRemarks;
  onRefresh: () => void;
}

export function DailyAuditModal({
  isOpen,
  onClose,
  date,
  userId = 'usr_default',
  isSubmitted,
  totals,
  targets,
  breakdown,
  remarks,
  onRefresh,
}: DailyAuditModalProps) {
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(!isSubmitted);
  const [showCalculationInfo, setShowCalculationInfo] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirmSubmit = async () => {
    setLoading(true);
    // 1. Submit locally for instant calendar archive
    clientStorage.submitDay(userId, date, breakdown.overall);

    try {
      const res = await fetch('/api/journal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      toast.success('Day submitted and Daily Food Audit generated!');
      setShowConfirmSubmit(false);
      onRefresh();
    } catch (err: unknown) {
      console.warn('Network issue during submit, saved locally:', err);
      toast.success('Day submitted and archived in Calendar!');
      setShowConfirmSubmit(false);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockDay = async () => {
    setLoading(true);
    // 1. Unlock locally
    clientStorage.unsubmitDay(userId, date);

    try {
      const res = await fetch('/api/journal/unsubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock');

      toast.info('Day unlocked for editing. You can modify entries and resubmit.');
      onRefresh();
      onClose();
    } catch (err: unknown) {
      console.warn('Network issue during unlock, saved locally:', err);
      toast.info('Day unlocked for editing.');
      onRefresh();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (consumed: number, target: number, type: string) => {
    if (target <= 0) return null;
    const ratio = consumed / target;

    if (type === 'calories') {
      if (ratio >= 0.9 && ratio <= 1.1) {
        return { label: 'Within estimated target', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', dot: '🟢' };
      }
      if (ratio < 0.9) {
        return { label: 'Below target', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', dot: '🟡' };
      }
      return { label: 'Above target', color: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300', dot: '🟠' };
    }

    if (type === 'discretionary') {
      if (consumed === 0) {
        return { label: 'Zero discretionary items', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', dot: '🟢' };
      }
      if (consumed <= 2) {
        return { label: 'Within moderate limit', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', dot: '🟡' };
      }
      return { label: 'Higher than personal target', color: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300', dot: '🟠' };
    }

    if (ratio >= 0.95) {
      return { label: 'Goal achieved', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', dot: '🟢' };
    }
    if (ratio >= 0.75) {
      return { label: 'Slightly below target', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', dot: '🟡' };
    }
    return { label: 'Below target', color: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300', dot: '🟠' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">DAILY FOOD AUDIT</h2>
              <p className="text-xs text-slate-500">Comprehensive end-of-day nutritional review • {date}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {showConfirmSubmit && !isSubmitted ? (
            /* --- STEP 1: SUBMISSION CONFIRMATION PROMPT --- */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Have you finished entering today's food, water and steps?
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Submitting today will finalize your Daily Food Audit, compute your Daily Goal Completion percentage, and generate personalized nutrition remarks.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
                >
                  {loading ? 'Submitting...' : 'Submit Day'}
                </button>
              </div>
            </div>
          ) : (
            /* --- STEP 2: FULL DAILY FOOD AUDIT REPORT --- */
            <div className="space-y-6">
              {/* Daily Goal Completion Hero */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="text-center sm:text-left space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Daily Goal Completion
                  </div>
                  <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                    {breakdown.overall}% Goal Completion
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    Deterministic score calculated from your calories, protein, fibre, hydration, and activity goals.
                  </p>

                  <button
                    onClick={() => setShowCalculationInfo(!showCalculationInfo)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showCalculationInfo ? 'Hide formula' : 'How is this calculated?'}
                  </button>
                </div>

                <CircularProgress
                  value={breakdown.overall}
                  size={110}
                  strokeWidth={9}
                  color="#10b981"
                >
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {breakdown.overall}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Achieved</span>
                </CircularProgress>
              </div>

              {/* Transparent Formula Details (Expandable) */}
              {showCalculationInfo && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <p className="font-bold text-slate-900 dark:text-white">Formula Breakdown Weights:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Calories Compliance: 25% weight (target: {targets.calorieTarget} kcal)</li>
                    <li>Protein Compliance: 20% weight (target: {targets.proteinTarget}g)</li>
                    <li>Fibre Compliance: 15% weight (target: {targets.fibreTarget}g)</li>
                    <li>Water Compliance: 15% weight (target: {targets.waterTarget} ml)</li>
                    <li>Steps Compliance: 15% weight (target: {targets.stepTarget.toLocaleString()})</li>
                    <li>Tracking Consistency: 10% weight (at least 3 meals logged)</li>
                  </ul>
                  {breakdown.discretionaryPenalty > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      Notice: -{breakdown.discretionaryPenalty}% applied due to excessive discretionary foods.
                    </p>
                  )}
                </div>
              )}

              {/* Audit Targets Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Target Compliance Audit
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Calories */}
                  {(() => {
                    const status = getStatusBadge(totals.calories, targets.calorieTarget, 'calories');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Calories</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.calories} / {targets.calorieTarget} kcal
                        </div>
                        <ProgressBar value={totals.calories} max={targets.calorieTarget} color="bg-emerald-500" heightClass="h-1.5" />
                      </div>
                    );
                  })()}

                  {/* Protein */}
                  {(() => {
                    const status = getStatusBadge(totals.protein, targets.proteinTarget, 'protein');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Protein</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.protein} / {targets.proteinTarget} g
                        </div>
                        <ProgressBar value={totals.protein} max={targets.proteinTarget} color="bg-teal-500" heightClass="h-1.5" />
                      </div>
                    );
                  })()}

                  {/* Fibre */}
                  {(() => {
                    const status = getStatusBadge(totals.fibre, targets.fibreTarget, 'fibre');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Fibre</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.fibre} / {targets.fibreTarget} g
                        </div>
                        <ProgressBar value={totals.fibre} max={targets.fibreTarget} color="bg-amber-500" heightClass="h-1.5" />
                      </div>
                    );
                  })()}

                  {/* Water */}
                  {(() => {
                    const status = getStatusBadge(totals.water, targets.waterTarget, 'water');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Water</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.water} / {targets.waterTarget} ml
                        </div>
                        <ProgressBar value={totals.water} max={targets.waterTarget} color="bg-blue-500" heightClass="h-1.5" />
                      </div>
                    );
                  })()}

                  {/* Steps */}
                  {(() => {
                    const status = getStatusBadge(totals.steps, targets.stepTarget, 'steps');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Steps</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.steps.toLocaleString()} / {targets.stepTarget.toLocaleString()}
                        </div>
                        <ProgressBar value={totals.steps} max={targets.stepTarget} color="bg-purple-500" heightClass="h-1.5" />
                      </div>
                    );
                  })()}

                  {/* Discretionary Foods */}
                  {(() => {
                    const status = getStatusBadge(totals.discretionaryCount, 2, 'discretionary');
                    return (
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Discretionary Foods</span>
                          {status && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.color}`}>
                              {status.dot} {status.label}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                          {totals.discretionaryCount} {totals.discretionaryCount === 1 ? 'entry' : 'entries'}
                        </div>
                        <div className="text-xs text-slate-500">
                          Target: 0–2 discretionary items per day
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Personalized Daily Remarks */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Personalized Daily Observations
                </h4>

                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  {remarks.positive && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5">
                      <span className="text-base">🌟</span>
                      <p><strong>Positive:</strong> {remarks.positive}</p>
                    </div>
                  )}

                  {remarks.improvement && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5">
                      <span className="text-base">💡</span>
                      <p><strong>Improvement:</strong> {remarks.improvement}</p>
                    </div>
                  )}

                  {remarks.water && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-2.5">
                      <span className="text-base">💧</span>
                      <p><strong>Hydration:</strong> {remarks.water}</p>
                    </div>
                  )}

                  {remarks.steps && (
                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 flex items-start gap-2.5">
                      <span className="text-base">👟</span>
                      <p><strong>Activity:</strong> {remarks.steps}</p>
                    </div>
                  )}

                  {remarks.discretionary && (
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                      <span className="text-base">🍪</span>
                      <p><strong>Food Balance:</strong> {remarks.discretionary}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Disclaimer */}
              <DisclaimerBanner compact />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          {isSubmitted ? (
            <>
              <button
                type="button"
                onClick={handleUnlockDay}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Day (Make Corrections)
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition"
              >
                Done
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
