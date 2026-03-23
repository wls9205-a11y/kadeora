import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    await req.json()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}