import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { getDatabase } from './db';
import { Profile, User } from './types';

const AUTH_SECRET = process.env.AUTH_SECRET || 'nutritrack-secure-auth-secret-key-2026';
const COOKIE_NAME = 'nutritrack_session';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function createSignedToken(payload: { userId: string; email: string; expiresAt: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifySignedToken(token: string): { userId: string; email: string; expiresAt: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    if (!data || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

// Developer mailbox log for local testing & fallback
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
const devMailboxPath = path.join(dataDir, 'dev-mailbox.json');

function logDevMailbox(email: string, otp: string) {
  try {
    let entries: Array<{ email: string; otp: string; time: string }> = [];
    if (fs.existsSync(devMailboxPath)) {
      try {
        const raw = fs.readFileSync(devMailboxPath, 'utf8');
        if (raw && raw.trim()) {
          entries = JSON.parse(raw);
        }
      } catch {
        entries = [];
      }
    }
    entries.unshift({ email, otp, time: new Date().toISOString() });
    if (entries.length > 50) entries = entries.slice(0, 50);
    try {
      fs.writeFileSync(devMailboxPath, JSON.stringify(entries, null, 2), 'utf8');
    } catch {
      // Ignore write errors in read-only environments
    }
    console.log(`\n========================================\n[NutriTrack Secure Email Service]\nTo: ${email}\nOTP: ${otp}\nValid for 10 minutes.\n========================================\n`);
  } catch (err) {
    console.error('Error writing dev mailbox:', err);
  }
}

async function dispatchOtpEmail(email: string, otp: string) {
  // Always log to server dev mailbox for audit/backup
  logDevMailbox(email, otp);

  // Method 1: Resend API (Recommended - fastest & no Google 2FA hassle)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NutriTrack <onboarding@resend.dev>',
          to: [email],
          subject: `🔐 ${otp} is your NutriTrack verification code`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0f172a; border-radius: 20px; color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 14px; line-height: 48px; font-size: 24px;">🥗</div>
                <h1 style="font-size: 22px; font-weight: 800; margin: 12px 0 4px; color: #ffffff; letter-spacing: -0.5px;">NutriTrack</h1>
                <p style="font-size: 13px; color: #94a3b8; margin: 0;">Personal Nutrition & Fitness Tracker</p>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 28px 20px; text-align: center;">
                <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 16px;">Here is your one-time verification code to log in or create your account:</p>
                <div style="display: inline-block; background: #10b981; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 12px 28px; border-radius: 12px; margin-bottom: 16px; font-family: monospace;">
                  ${otp}
                </div>
                <p style="font-size: 12px; color: #94a3b8; margin: 0;">⏳ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
              </div>
              <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 24px;">If you did not request this email, no action is needed.</p>
            </div>
          `,
        }),
      });

      if (res.ok) {
        console.log(`[NutriTrack Mailer] Real email delivered via Resend to ${email}`);
        return;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.error(`[NutriTrack Mailer] Resend API error:`, errJson);
      }
    } catch (err) {
      console.error(`[NutriTrack Mailer] Resend delivery failed:`, err);
    }
  }

  // Method 2: Gmail SMTP via Nodemailer
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

  if (!smtpUser || !smtpPass) {
    console.log(`[NutriTrack Mailer] No SMTP credentials configured. OTP logged to server logs.`);
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: `"NutriTrack" <${smtpUser}>`,
      to: email,
      subject: `🔐 ${otp} is your NutriTrack verification code`,
      text: `Your NutriTrack verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this code, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0f172a; border-radius: 20px; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 14px; line-height: 48px; font-size: 24px;">🥗</div>
            <h1 style="font-size: 22px; font-weight: 800; margin: 12px 0 4px; color: #ffffff; letter-spacing: -0.5px;">NutriTrack</h1>
            <p style="font-size: 13px; color: #94a3b8; margin: 0;">Personal Nutrition & Fitness Tracker</p>
          </div>
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 28px 20px; text-align: center;">
            <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 16px;">Here is your one-time verification code to log in or create your account:</p>
            <div style="display: inline-block; background: #10b981; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 12px 28px; border-radius: 12px; margin-bottom: 16px; font-family: monospace;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">⏳ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
          </div>
          <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 24px;">If you did not request this email, no action is needed.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[NutriTrack Mailer] Real email delivered to ${email} (MessageId: ${info.messageId})`);
  } catch (error) {
    console.error(`[NutriTrack Mailer] Failed to deliver real email via SMTP:`, error);
  }
}

export function hashOtp(email: string, otp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${email.toLowerCase()}:${otp}:${AUTH_SECRET}`)
    .digest('hex');
}

export async function sendOtp(email: string): Promise<{ success: boolean; message: string; cooldownRemaining?: number }> {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDatabase();

  // Check cooldown from last OTP
  const recentOtp = db
    .prepare('SELECT created_at FROM otps WHERE email = ? ORDER BY created_at DESC LIMIT 1')
    .get(normalizedEmail) as { created_at: string } | undefined;

  if (recentOtp) {
    const elapsed = Date.now() - new Date(recentOtp.created_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        cooldownRemaining: waitSeconds,
      };
    }
  }

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashOtp(normalizedEmail, otp);
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const now = new Date().toISOString();
  const id = 'otp_' + crypto.randomUUID();

  // Invalidate older OTPs for this email
  db.prepare('DELETE FROM otps WHERE email = ?').run(normalizedEmail);

  // Store new OTP
  db.prepare(`
    INSERT INTO otps (id, email, otp_hash, expires_at, attempts, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(id, normalizedEmail, otpHash, expiresAt, now);

  // Dispatch OTP (real email via SMTP + server log fallback)
  await dispatchOtpEmail(normalizedEmail, otp);

  return {
    success: true,
    message: 'OTP has been sent to your email address.',
  };
}

export async function verifyOtp(email: string, otp: string): Promise<{
  success: boolean;
  message: string;
  token?: string;
  isNewUser?: boolean;
}> {
  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = otp.trim();
  const db = getDatabase();

  const record = db
    .prepare('SELECT * FROM otps WHERE email = ? ORDER BY created_at DESC LIMIT 1')
    .get(normalizedEmail) as
    | { id: string; otp_hash: string; expires_at: number; attempts: number }
    | undefined;

  if (!record) {
    return { success: false, message: 'No OTP request found. Please request a new code.' };
  }

  if (Date.now() > record.expires_at) {
    db.prepare('DELETE FROM otps WHERE id = ?').run(record.id);
    return { success: false, message: 'OTP has expired. Please request a new code.' };
  }

  if (record.attempts >= 5) {
    db.prepare('DELETE FROM otps WHERE id = ?').run(record.id);
    return { success: false, message: 'Too many invalid attempts. Please request a new code.' };
  }

  const expectedHash = hashOtp(normalizedEmail, cleanOtp);
  if (record.otp_hash !== expectedHash) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    return { success: false, message: 'Invalid OTP code. Please check and try again.' };
  }

  // OTP is valid - consume it
  db.prepare('DELETE FROM otps WHERE id = ?').run(record.id);

  // Find or create user
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;
  let isNewUser = false;
  const now = new Date().toISOString();

  if (!user) {
    isNewUser = true;
    const userId = 'usr_' + crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, email, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, normalizedEmail, now, now);

    user = { id: userId, email: normalizedEmail, created_at: now, updated_at: now };
  } else {
    // Check if user has a profile
    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id);
    isNewUser = !profile;
  }

  // Create persistent session (180 days)
  const sessionExpiresAt = Date.now() + 180 * 24 * 60 * 60 * 1000;
  const token = createSignedToken({
    userId: user.id,
    email: user.email,
    expiresAt: sessionExpiresAt,
  });
  const sessionId = 'ses_' + crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, user.id, token, sessionExpiresAt, now);
  } catch {
    // Session insertion safe fallback
  }

  return {
    success: true,
    message: 'Authentication successful',
    token,
    isNewUser,
  };
}

export async function getCurrentUser(): Promise<{ user: User; profile: Profile | null } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDatabase();

  // First, verify HMAC-signed persistent token (works across serverless cold starts & 180 days)
  const payload = verifySignedToken(token);
  if (payload) {
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as unknown as User | undefined;
    if (!user) {
      // Re-hydrate user in SQLite instance if serverless container restarted
      const now = new Date().toISOString();
      try {
        db.prepare('INSERT OR IGNORE INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
          payload.userId,
          payload.email,
          now,
          now
        );
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as unknown as User | undefined;
      } catch (err) {
        console.warn('Could not re-hydrate user into local instance:', err);
      }
    }

    if (user) {
      const profile = (db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as unknown as Profile) || null;
      return { user, profile };
    }
  }

  // Fallback to database session lookup for legacy hex tokens
  const session = db
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?')
    .get(token, Date.now()) as { user_id: string } | undefined;

  if (!session) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as unknown as User | undefined;
  if (!user) return null;

  const profile = (db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as unknown as Profile) || null;

  return { user, profile };
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } catch {
      // ignore
    }
    cookieStore.delete(COOKIE_NAME);
  }
}

export { COOKIE_NAME };
