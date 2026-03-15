import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[Bug Report]', body)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}