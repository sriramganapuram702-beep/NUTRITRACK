import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: auth.user.id,
        email: auth.user.email,
      },
      profile: auth.profile,
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
