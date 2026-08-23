/**
 * v5-V4 — 어드민 조감도(hero_image) 업로드.
 *
 * hero_image_url 이 0건인 건 정책 때문이 아니라 넣을 화면이 없어서였다.
 * 컬럼(hero_image_url · hero_image_source · hero_image_credit)과 화면 체인은 전부 이미 있다.
 *
 * GET  ?q=  : 현장 검색 (apt_sites.name / slug). 현재 조감도 보유 여부까지 같이 준다.
 * POST      : multipart/form-data { slug, credit, file } → webp 변환 → apt-covers 업로드 → 3필드 동시 갱신
 * DELETE    : { slug } → 3필드를 함께 null 로. 파일도 지운다.
 *
 * ⚠️ 버킷은 apt-covers 다 (images 아님).
 *    images 는 RLS 가 auth.uid() 폴더를 강제해 어드민 대리 업로드에 맞지 않는다.
 *    apt-covers 는 service_role 전용 정책 4종이 완비돼 있고 4월부터 비어 있었다.
 * ⚠️ 버킷 용량 한도 2MB. 시행사 원본 JPG 는 그보다 큰 경우가 많아
 *    저장 전에 sharp 로 webp 변환한다 (apt-satellite-crawl 과 같은 패턴).
 * ⚠️ 출처(credit)는 필수다. 누구에게 어떤 형태로 허락받았는지가 안 남으면 그게 리스크다.
 *    빈 값이면 저장하지 않는다 — 파일 업로드도 하지 않는다.
 * ⚠️ 3필드는 항상 함께 쓰고 함께 지운다. 하나라도 어긋나면 출처 없는 사진이 화면에 나간다.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

const BUCKET = 'apt-covers';
/** 큐레이션 캐러셀 대형 노출이 최대 소비처다. 1600 이면 2x 레티나까지 덮는다. */
const MAX_WIDTH = 1600;
/** 버킷 한도 2MB. 변환 후에도 넘으면 품질을 한 단계 낮춰 재시도한다. */
const BUCKET_LIMIT = 2 * 1024 * 1024;
/** 업로드 원본 상한 — 변환 전에 거른다. sharp 에 20MB 를 밀어넣지 않는다. */
const MAX_INPUT = 25 * 1024 * 1024;

const SITE_COLS = 'id, slug, name, region, sigungu, hero_image_url, hero_image_source, hero_image_credit, satellite_image_url';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [], hint: '두 글자 이상 입력하세요' });
  }

  const { data, error } = await (admin as any)
    .from('apt_sites')
    .select(SITE_COLS)
    .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
    .eq('is_active', true)
    .order('content_score', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    console.error('[admin/apt-cover] search error:', JSON.stringify(error));
    return NextResponse.json({ error: '검색 실패' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data 가 아닙니다' }, { status: 400 });
  }

  const slug = String(form.get('slug') || '').trim();
  const credit = String(form.get('credit') || '').trim();
  const file = form.get('file');

  if (!slug) return NextResponse.json({ error: '현장을 선택하세요' }, { status: 400 });
  // 출처가 없으면 파일에 손도 대지 않는다. 허락 근거 없는 이미지가 쌓이는 것이 최대 리스크다.
  if (!credit) {
    return NextResponse.json({ error: '허락 출처는 필수입니다 (누구에게 어떤 형태로 받았는지)' }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: '이미지 파일이 없습니다' }, { status: 400 });
  }
  if (file.size > MAX_INPUT) {
    return NextResponse.json({ error: `원본이 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB · 상한 25MB)` }, { status: 400 });
  }

  const { data: site, error: siteErr } = await (admin as any)
    .from('apt_sites')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (siteErr || !site) {
    return NextResponse.json({ error: '현장을 찾을 수 없습니다' }, { status: 404 });
  }

  // ── webp 변환 (apt-satellite-crawl 과 같은 패턴) ──
  let webp: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const base = sharp(input, { failOn: 'none' })
      // 조감도는 잘라내면 건물이 잘린다 — cover 가 아니라 inside 로 축소만 한다.
      .resize({ width: MAX_WIDTH, withoutEnlargement: true, fit: 'inside' });
    webp = await base.webp({ quality: 85, effort: 4 }).toBuffer();
    if (webp.length > BUCKET_LIMIT) {
      webp = await base.webp({ quality: 72, effort: 5 }).toBuffer();
    }
  } catch (e: any) {
    console.error('[admin/apt-cover] sharp:', e?.message ?? String(e));
    return NextResponse.json({ error: '이미지를 처리할 수 없습니다 (손상되었거나 지원하지 않는 형식)' }, { status: 400 });
  }
  if (webp.length > BUCKET_LIMIT) {
    return NextResponse.json({ error: '변환 후에도 2MB 를 넘습니다. 더 작은 원본을 쓰세요' }, { status: 400 });
  }

  const path = `hero/${site.id}.webp`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: 'public, max-age=31536000, immutable',
  });
  if (upErr) {
    console.error('[admin/apt-cover] upload:', upErr.message);
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) {
    return NextResponse.json({ error: '공개 URL 을 얻지 못했습니다' }, { status: 500 });
  }
  // 파일명이 고정(hero/{id}.webp)이라 교체 시 CDN 이 옛 이미지를 계속 준다.
  // 쿼리로 버전을 붙여 즉시 갱신되게 한다.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  // 3필드는 항상 함께 쓴다. 하나라도 빠지면 출처 없는 사진이 화면에 나간다.
  const { error: updErr } = await (admin as any)
    .from('apt_sites')
    .update({
      hero_image_url: versioned,
      hero_image_source: 'developer',
      hero_image_credit: credit,
    })
    .eq('id', site.id);
  if (updErr) {
    console.error('[admin/apt-cover] update:', JSON.stringify(updErr));
    return NextResponse.json({ error: `DB 갱신 실패: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    slug: site.slug,
    name: site.name,
    hero_image_url: versioned,
    hero_image_credit: credit,
    bytes: webp.length,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다' }, { status: 400 });
  }
  const slug = (body.slug || '').trim();
  if (!slug) return NextResponse.json({ error: 'slug 가 필요합니다' }, { status: 400 });

  const { data: site } = await (admin as any)
    .from('apt_sites')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다' }, { status: 404 });

  // 파일 삭제가 실패해도 DB 는 비운다 — 화면에 안 나가는 것이 먼저다.
  const { error: rmErr } = await admin.storage.from(BUCKET).remove([`hero/${site.id}.webp`]);
  if (rmErr) console.warn('[admin/apt-cover] remove:', rmErr.message);

  const { error: updErr } = await (admin as any)
    .from('apt_sites')
    .update({ hero_image_url: null, hero_image_source: null, hero_image_credit: null })
    .eq('id', site.id);
  if (updErr) {
    return NextResponse.json({ error: `DB 갱신 실패: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug: site.slug });
}
