import { NextResponse } from 'next/server';
import { sendOtp } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const result = await sendOtp(email);
    if (!result.success) {
      return NextResponse.json(result, { status: 429 });
    }

    // Do NOT return OTP code in response!
    return NextResponse.json({
      success: true,
      message: 'One-Time Password (OTP) has been sent to your email.',
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred while sending the OTP.' },
      { status: 500 }
    );
  }
}
