import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const { searchParams } = new URL(req.url);
    const aptName = searchParams.get('apt_name');
    const region = searchParams.get('region');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 10;

    let query = getSupabaseAdmin().from('apt_reviews')
      .select('*, profiles!apt_reviews_user_id_fkey(nickname, grade)', { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (aptName) query = query.ilike('apt_name', `%${aptName}%`);
    if (region) query = query.ilike('region_nm', `%${region}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    // 평균 평점 계산
    let avgRating = 0;
    if (aptName) {
      const { data: avgData } = await getSupabaseAdmin().from('apt_reviews')
        .select('rating').ilike('apt_name', `%${aptName}%`).eq('is_deleted', false);
      if (avgData?.length) {
        avgRating = avgData.reduce((s, r) => s + r.rating, 0) / avgData.length;
      }
    }

    return NextResponse.json({
      reviews: data || [], total: count || 0, avgRating: Math.round(avgRating * 10) / 10,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { apt_name, region_nm, rating, pros, cons, content, living_years, is_resident } = body;

    if (!apt_name || !rating || !content) {
      return NextResponse.json({ error: '단지명, 평점, 내용은 필수입니다' }, { status: 400 });
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      return NextResponse.json({ error: '평점은 1~5점 사이입니다' }, { status: 400 });
    }
    const cleanContent = sanitizeText(String(content));
    if (cleanContent.length < 20) {
      return NextResponse.json({ error: '리뷰는 20자 이상 작성해주세요' }, { status: 400 });
    }
    if (cleanContent.length > 2000) {
      return NextResponse.json({ error: '리뷰는 2000자 이내로 작성해주세요' }, { status: 400 });
    }

    // 같은 단지에 중복 리뷰 방지 (유저당 1개)
    const { data: existing } = await getSupabaseAdmin().from('apt_reviews')
      .select('id').eq('user_id', user.id).ilike('apt_name', apt_name).eq('is_deleted', false).limit(1);
    if (existing?.length) {
      return NextResponse.json({ error: '이미 해당 단지에 리뷰를 작성했습니다' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().from('apt_reviews').insert({
      user_id: user.id,
      apt_name: sanitizeText(String(apt_name)).slice(0, 100),
      region_nm: region_nm ? sanitizeText(String(region_nm)).slice(0, 50) : null,
      rating: Number(rating),
      pros: pros ? sanitizeText(String(pros)).slice(0, 200) : null,
      cons: cons ? sanitizeText(String(cons)).slice(0, 200) : null,
      content: cleanContent.slice(0, 2000),
      living_years: living_years ? Math.min(Math.max(0, Number(living_years)), 50) : null,
      is_resident: !!is_resident,
    }).select().single();

    if (error) throw error;

    // 리뷰 작성 포인트
    try { await getSupabaseAdmin().rpc('award_points', { p_user_id: user.id, p_amount: 10, p_reason: '아파트리뷰작성' }); } catch { }

    return NextResponse.json({ review: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
