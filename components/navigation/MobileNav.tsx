'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Droplets,
  CalendarDays,
  UserCog,
  Plus,
} from 'lucide-react';

export function MobileNav({ onQuickAddFood }: { onQuickAddFood?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Journal', href: '/journal', icon: UtensilsCrossed },
    // Center floating button
    { name: 'Water', href: '/water', icon: Droplets },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Profile', href: '/profile', icon: UserCog },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 pb-safe">
      <div className="flex items-center justify-around relative">
        {navItems.slice(0, 2).map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium transition ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Floating Add Food center button */}
        <div className="relative -top-5">
          <Link
            href="/journal?action=add"
            className="w-13 h-13 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition"
            title="Add Food"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </Link>
        </div>

        {navItems.slice(2).map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium transition ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
