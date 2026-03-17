import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    sitemap: 'https://kadeora.app/sitemap.xml',
    timestamp: new Date().toISOString(),
  });
}
