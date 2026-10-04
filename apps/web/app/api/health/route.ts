import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    appUrl: Boolean(process.env.APP_URL),
  };
  const ok = checks.supabaseUrl && checks.supabaseKey;
  return NextResponse.json({ ok, service: 'ai-creative-os', checks, timestamp: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
