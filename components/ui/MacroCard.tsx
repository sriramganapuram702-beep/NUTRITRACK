import React from 'react';
import { ProgressBar } from './ProgressBar';

interface MacroCardProps {
  title: string;
  consumed: number;
  target: number;
  unit: string;
  icon: React.ReactNode;
  colorClass: string;
  barColor: string;
  subtitle?: string;
  onClick?: () => void;
}

export function MacroCard({
  title,
  consumed,
  target,
  unit,
  icon,
  colorClass,
  barColor,
  subtitle,
  onClick,
}: MacroCardProps) {
  const percentage = target > 0 ? Math.round((consumed / target) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`relative p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-200 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {percentage}%
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {consumed.toLocaleString()}
        </span>
        <span className="text-xs md:text-sm font-medium text-slate-400">
          / {target.toLocaleString()} {unit}
        </span>
      </div>

      <ProgressBar value={consumed} max={target || 1} color={barColor} heightClass="h-2" />
    </div>
  );
}
