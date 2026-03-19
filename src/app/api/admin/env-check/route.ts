import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

const REQUIRED_SERVER_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRETT',
  'CRON_SECRET',
  'ANTHROPIC_API_KEY',
  'UNSOLD_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

const REQUIRED_PUBLIC_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'NEXT_PUBLIC_SITE_URL',
]

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  return NextResponse.json({
    serverVars: REQUIRED_SERVER_VARS.map(k => ({ key: k, set: !!process.env[k] })),
    publicVars: REQUIRED_PUBLIC_VARS.map(k => ({ key: k, set: !!process.env[k] })),
    nextPublicVarNames: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')),
  })
}
