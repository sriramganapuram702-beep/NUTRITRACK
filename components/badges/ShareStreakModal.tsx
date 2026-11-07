'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  X,
  Share2,
  Copy,
  Check,
  Flame,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface StreakData {
  currentStreak: number;
  totalDaysLogged: number;
  badgeTier: string;
  badgeIcon: string;
  badgeColor: string;
  userName: string;
  shareText: string;
}

interface ShareStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareStreakModal({ isOpen, onClose }: ShareStreakModalProps) {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchStreak = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/profile/streak');
        const data = await res.json();
        if (data.success) {
          setStreak(data.streak);
        }
      } catch (err) {
        console.error('Failed to load streak:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStreak();
  }, [isOpen]);

  const handleCopyText = () => {
    if (!streak) return;
    navigator.clipboard.writeText(streak.shareText);
    setCopied(true);
    toast.success('Streak message copied! Paste anywhere on WhatsApp or Stories.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    if (!streak) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(streak.shareText)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Shareable Streak Badge
              </h2>
              <p className="text-xs text-slate-500">Celebrate your nutrition discipline with friends</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Visual Badge Card */}
        <div className="p-6 space-y-5">
          {streak ? (
            <div className="relative rounded-3xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white shadow-xl border border-emerald-500/30 overflow-hidden text-center space-y-4">
              {/* Decorative background circle */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> NutriTrack
                </span>
                <span>Verified Streak</span>
              </div>

              {/* Big Streak Counter */}
              <div className="py-2">
                <span className="text-5xl font-black tracking-tight text-white flex items-center justify-center gap-2">
                  <Flame className="w-12 h-12 text-amber-400 animate-pulse fill-amber-400" />
                  {streak.currentStreak}
                </span>
                <span className="text-xs uppercase tracking-widest text-emerald-300 font-bold block mt-1">
                  Day Streak Active!
                </span>
              </div>

              {/* Badge Tier Pill */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-amber-300">
                <span className="text-base">{streak.badgeIcon}</span>
                <span>{streak.badgeTier}</span>
              </div>

              {/* User Name & Details */}
              <div className="pt-2 border-t border-white/10 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white text-sm">{streak.userName}</p>
                <p className="text-[11px] text-slate-400">
                  {streak.totalDaysLogged} total daily audits logged • Consistency is Key
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">Loading your streak badge...</div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Streak on WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Shareable Text'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
