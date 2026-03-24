import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

// GET: 활성 프리미엄 리스팅 목록 (분양중 탭에서 호출)
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('premium_listings')
      .select('*, consultant:consultant_profiles(name, phone, kakao_id, company, profile_image, is_verified)')
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('tier', { ascending: false }) // premium > pro > basic
      .order('created_at', { ascending: false });

    return NextResponse.json({ listings: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 프리미엄 리스팅 생성 (결제 후 호출)
export async function POST(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = await createSupabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

    const body = await req.json();
    const { listing_type, listing_id, house_nm, region_nm, tier, images, description, cta_text, cta_phone, cta_kakao, months } = body;

    if (!listing_type || !listing_id || !tier) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 상담사 프로필 확인
    const { data: consultant } = await admin.from('consultant_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!consultant) {
      return NextResponse.json({ error: '상담사 등록이 필요합니다' }, { status: 400 });
    }

    // 기간 계산
    const durationMonths = months || 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // 가격 계산
    const prices: Record<string, number> = { basic: 49000, pro: 149000, premium: 299000 };
    const pricePaid = (prices[tier] || 49000) * durationMonths;

    const { data: listing, error } = await admin.from('premium_listings').insert({
      consultant_id: consultant.id,
      listing_type,
      listing_id: String(listing_id),
      house_nm: house_nm || null,
      region_nm: region_nm || null,
      tier,
      images: images || [],
      description: description || null,
      cta_text: cta_text || '분양 상담 받기',
      cta_phone: cta_phone || null,
      cta_kakao: cta_kakao || null,
      starts_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      price_paid: pricePaid,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing, created: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 클릭 추적 (노출/클릭/CTA/전화)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { listing_id, type } = body; // type: 'impression' | 'click' | 'cta' | 'phone'

    if (!listing_id || !type) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (type === 'impression') {
      await admin.rpc('increment_listing_impression', { p_listing_id: listing_id }).then(() => {});
    } else {
      await admin.rpc('increment_listing_click', { p_listing_id: listing_id, p_click_type: type }).then(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
