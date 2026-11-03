import React from 'react';
import { Info } from 'lucide-react';

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100/70 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Estimated nutrition targets & values are for general informational purposes only.</span>
      </div>
    );
  }

  return (
    <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5">
      <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
      <p className="leading-relaxed">
        <strong>Nutrition Disclaimer:</strong> Nutrition values and targets are estimates and may vary based on ingredients, preparation method, and individual portion size. This application is designed for personal informational and tracking purposes and is not a substitute for professional medical or dietary advice.
      </p>
    </div>
  );
}
