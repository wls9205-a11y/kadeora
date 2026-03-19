import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // KIS API 키 미설정 - apiportal.koreainvestment.com에서 발급 필요
  // KIS_APP_KEY, KIS_APP_SECRET 환경변수 등록 후 구현 예정
  return NextResponse.json({ message: 'KIS API not configured yet' }, { status: 200 });
}
