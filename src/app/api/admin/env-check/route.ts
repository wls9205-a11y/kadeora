import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const REQUIRED_SERVER_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'ANTHROPIC_API_KEY',
  'UNSOLD_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SENTRY_DSN',
  'TOSS_SECRET_KEY',
]

const REQUIRED_PUBLIC_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_KAKAO_JS_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_TOSS_CLIENT_KEY',
]

export async function GET() {
  try {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  return NextResponse.json({
    serverVars: REQUIRED_SERVER_VARS.map(k => ({ key: k, set: !!process.env[k] })),
    publicVars: REQUIRED_PUBLIC_VARS.map(k => ({ key: k, set: !!process.env[k] })),
  })
} catch (e: unknown) {
    console.error('[admin] GET', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
