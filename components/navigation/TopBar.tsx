'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Flame, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  userEmail?: string;
}

export function TopBar({ title, subtitle, userEmail }: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out. Enter any email to continue.');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile brand indicator */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white">
            <Flame className="w-5 h-5" />
          </div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">NutriTrack</span>
        </div>

        <div className="hidden md:block">
          {title && <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>}
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* User Account Badge */}
        {userEmail && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
            <UserIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="max-w-[180px] truncate">{userEmail}</span>
          </div>
        )}

        {/* Switch Account / Sign Out */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition border border-rose-200/50 dark:border-rose-900/50"
          title="Sign out and log in with another email"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Switch User</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
        </button>
      </div>
    </header>
  );
}
