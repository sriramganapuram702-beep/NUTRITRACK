'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { TopBar } from '@/components/navigation/TopBar';
import { DailyAuditModal } from '@/components/audit/DailyAuditModal';
import { DailyGoalBreakdown, DailyRemarks, User } from '@/lib/types';

export default function AuditDatePage() {
  const params = useParams();
  const router = useRouter();
  const dateStr = (params?.date as string) || new Date().toISOString().split('T')[0];

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<{
    date: string;
    isSubmitted: boolean;
    totals: any;
    targets: any;
    breakdown: DailyGoalBreakdown;
    remarks: DailyRemarks;
  } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/');
          return;
        }
        setUser(data.user);

        return fetch(`/api/journal?date=${dateStr}`);
      })
      .then((res) => (res ? res.json() : null))
      .then((journal) => {
        if (journal) {
          setAuditData({
            date: dateStr,
            isSubmitted: Boolean(journal.log?.is_submitted),
            totals: journal.totals,
            targets: journal.targets,
            breakdown: journal.breakdown,
            remarks: journal.remarks,
          });
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [dateStr, router]);

  if (loading || !auditData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar userEmail={user?.email} />

      <main className="flex-1 flex flex-col min-w-0 pb-24 md:pb-12">
        <TopBar title={`Daily Food Audit: ${dateStr}`} userEmail={user?.email} />

        <div className="max-w-4xl w-full mx-auto px-4 md:px-8 py-6">
          <DailyAuditModal
            isOpen={true}
            onClose={() => router.push('/dashboard')}
            date={auditData.date}
            isSubmitted={auditData.isSubmitted}
            totals={auditData.totals}
            targets={auditData.targets}
            breakdown={auditData.breakdown}
            remarks={auditData.remarks}
            onRefresh={() => router.refresh()}
          />
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
