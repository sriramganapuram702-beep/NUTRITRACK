'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Droplets,
  Footprints,
  CalendarDays,
  TrendingUp,
  UserCog,
  LogOut,
  Moon,
  Sun,
  Flame,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Food Journal', href: '/journal', icon: UtensilsCrossed },
  { name: 'Water Tracker', href: '/water', icon: Droplets },
  { name: 'Step Tracker', href: '/steps', icon: Footprints },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Monthly Progress', href: '/monthly', icon: TrendingUp },
  { name: 'Profile & Goals', href: '/profile', icon: UserCog },
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out successfully.');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Failed to log out.');
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-4 select-none z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-3 py-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
          <Flame className="w-6 h-6 fill-white/20" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            NutriTrack
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Nutrition & Fitness
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="pt-4 mt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
        {/* Dark/Light mode toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <span className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500">
            {theme === 'dark' ? 'On' : 'Off'}
          </span>
        </button>

        {/* User Info & Logout */}
        {userEmail && (
          <div className="px-3 py-1.5 text-xs text-slate-400 truncate">
            {userEmail}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
