'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Mail, ArrowRight, KeyRound, ShieldCheck, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DisclaimerBanner } from '@/components/ui/DisclaimerBanner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check if session already exists
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          if (!data.profile) {
            router.push('/onboarding');
          } else {
            router.push('/dashboard');
          }
        }
      })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, [router]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send OTP code.');
      }

      toast.success('A 6-digit OTP code has been sent to your email.');
      setStep('otp');
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending OTP';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length < 6) {
      toast.error('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification failed.');
      }

      toast.success('Successfully authenticated!');

      if (data.isNewUser) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 px-4 py-8 md:py-12">
      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
          <Flame className="w-6 h-6 fill-white/20" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">NutriTrack</h1>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
            Food • Nutrition • Fitness
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 p-6 md:p-8">
          {step === 'email' ? (
            /* --- STEP 1: ENTER EMAIL --- */
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In or Register</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Passwordless login. Enter your email to receive a secure 6-digit one-time password.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Protected by secure encrypted one-time passwords</span>
              </div>
            </form>
          ) : (
            /* --- STEP 2: VERIFY OTP --- */
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Enter Security Code</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the 6-digit OTP code dispatched to <strong className="text-slate-700 dark:text-slate-200">{email}</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    6-Digit Code
                  </label>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Valid for 10 min
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[0.6em] font-mono text-2xl py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>

              {/* Resend OTP button & Change email */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                  }}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleSendOtp()}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="w-full max-w-md mx-auto">
        <DisclaimerBanner compact />
      </div>
    </div>
  );
}
