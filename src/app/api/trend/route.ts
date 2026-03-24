import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('trending_keywords').select('keyword, heat_score').order('heat_score', { ascending: false }).limit(10);
    
    // 데이터가 없을 때 기본 인기 검색어
    if (!data || data.length === 0) {
      const defaults = [
        { keyword: '삼성전자', heat_score: 100 },
        { keyword: 'SK하이닉스', heat_score: 95 },
        { keyword: 'AI 반도체', heat_score: 90 },
        { keyword: '청약 경쟁률', heat_score: 85 },
        { keyword: '엔비디아', heat_score: 80 },
        { keyword: '기준금리 인하', heat_score: 75 },
        { keyword: '미분양 현황', heat_score: 70 },
        { keyword: 'ETF 추천', heat_score: 65 },
        { keyword: '재개발 투자', heat_score: 60 },
        { keyword: '배당주 TOP', heat_score: 55 },
      ];
      return NextResponse.json(defaults);
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const authSb = await createSupabaseServer();
    const { data: { user } } = await authSb.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.rpc('refresh_trending_keywords');
    if (error) { console.error('[Trend]', error); return NextResponse.json({ error: '트렌딩 갱신 실패' }, { status: 500 }); }
    return NextResponse.json({ success: true });
  } catch (err) { console.error('[Trend]', err); return NextResponse.json({ error: '서버 오류' }, { status: 500 }); }
}
