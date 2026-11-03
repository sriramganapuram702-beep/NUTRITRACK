import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100+
  max?: number;
  color?: string;
  heightClass?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'bg-emerald-500',
  heightClass = 'h-2.5',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${color} h-full rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
