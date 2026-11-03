import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifyOtp } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, message: 'Email and OTP are required.' },
        { status: 400 }
      );
    }

    const result = await verifyOtp(email, otp);
    if (!result.success || !result.token) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      isNewUser: result.isNewUser,
    });

    // Set HTTP-only secure cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, message: 'Server error during OTP verification.' },
      { status: 500 }
    );
  }
}
