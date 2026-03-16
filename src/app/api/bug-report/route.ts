import { NextResponse } from 'next/server'
export async function POST(req: Request) {
  try {
    await req.json()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 })
  }
}