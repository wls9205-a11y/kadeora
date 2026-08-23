/**
 * v5-V4 / v8-C — 어드민 조감도(hero_image) 업로드.
 *
 * hero_image_url 이 0건인 건 정책 때문이 아니라 넣을 화면이 없어서였다.
 * 컬럼(hero_image_url · hero_image_source · hero_image_credit)과 화면 체인은 전부 이미 있다.
 *
 * GET    ?q=                          현장 검색 (apt_sites.name / slug). 조감도 보유 여부 포함.
 * POST   multipart/form-data          { slug, credit, file } — 사람이 파일을 올린다 (세션 전용)
 * POST   application/json             { slug, url, credit } — 서버가 그 URL 을 받아온다
 * DELETE { slug }                     3필드를 함께 null 로 + 파일 삭제
 *
 * 두 POST 경로는 **검증·변환·저장이 완전히 같다** (storeCover 하나를 공유한다).
 * 다른 것은 바이트를 어디서 얻느냐뿐이다.
 *
 * ── 인증 ──
 *   multipart : requireAdmin() 세션 **전용**. 브라우저에서 사람이 올리는 경로다.
 *   json      : requireAdmin() 세션 **또는** 머신 토큰(verifyCronAuth).
 *               DB 담당이 pg_net 으로 직접 호출해 조감도를 넣기 위한 경로다.
 *   ⚠️ 머신 토큰을 multipart 에 열지 않는다 — 파일 업로드는 사람만 한다.
 *
 * ── 지키는 규칙 (두 경로 공통) ──
 *   버킷은 apt-covers 다 (images 아님). images 는 RLS 가 auth.uid() 폴더를 강제해
 *   어드민 대리 업로드에 맞지 않는다. apt-covers 는 service_role 전용 정책 4종이 완비돼 있다.
 *   버킷 용량 한도 2MB — 저장 전에 sharp 로 webp 변환한다 (apt-satellite-crawl 과 같은 패턴).
 *   ⚠️ 출처(credit)는 필수다. 누구에게 어떤 형태로 허락받았는지가 안 남으면 그게 리스크다.
 *      빈 값이면 저장하지 않는다 — 파일을 받아오지도 않는다.
 *   ⚠️ 3필드는 항상 함께 쓰고 함께 지운다. 하나라도 어긋나면 출처 없는 사진이 화면에 나간다.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/admin-auth';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const BUCKET = 'apt-covers';
/** 큐레이션 캐러셀 대형 노출이 최대 소비처다. 1600 이면 2x 레티나까지 덮는다. */
const MAX_WIDTH = 1600;
/** 버킷 한도 2MB. 변환 후에도 넘으면 품질을 한 단계 낮춰 재시도한다. */
const BUCKET_LIMIT = 2 * 1024 * 1024;
/** 입력 원본 상한 — 변환 전에 거른다. sharp 에 큰 버퍼를 밀어넣지 않는다. */
const MAX_INPUT = 25 * 1024 * 1024;
/** 원격 이미지 수신 제한시간. 라우트 maxDuration 30 안에서 변환 시간을 남긴다. */
const FETCH_TIMEOUT_MS = 15_000;

const SITE_COLS = 'id, slug, name, region, sigungu, hero_image_url, hero_image_source, hero_image_credit, satellite_image_url';

type Admin = ReturnType<typeof getSupabaseAdmin>;

/* ────────────────────────────── 인증 ────────────────────────────── */

/** 세션 전용. 사람이 브라우저에서 하는 조작에 쓴다. */
async function sessionOnly(): Promise<{ admin: Admin } | { error: NextResponse }> {
  const auth = await requireAdmin();
  // requireAdmin 성공 분기는 `error?: never` 라 'in' 만으로는 undefined 가 남는다.
  if ('error' in auth && auth.error) return { error: auth.error };
  return { admin: (auth as { admin: Admin }).admin };
}

/**
 * 세션 또는 머신 토큰.
 *
 * 머신 토큰 판정은 lib/cron-auth.ts 의 verifyCronAuth 하나만 쓴다 — 토큰 검사를
 * 여기서 다시 구현하면 규칙이 두 벌이 되고 한쪽만 고치게 된다.
 * 그 헬퍼가 받는 것: Bearer CRON_SECRET · Bearer PG_CRON_SHARED_SECRET ·
 * x-pg-cron-secret · x-vercel-cron (Vercel 이 외부 요청에서 strip 한다).
 */
async function sessionOrMachine(req: NextRequest): Promise<{ admin: Admin; via: 'session' | 'machine' } | { error: NextResponse }> {
  if (verifyCronAuth(req)) return { admin: getSupabaseAdmin(), via: 'machine' };
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return { error: auth.error };
  return { admin: (auth as { admin: Admin }).admin, via: 'session' };
}

/* ────────────────────────── 공통 저장 파이프라인 ────────────────────────── */

async function findSite(admin: Admin, slug: string) {
  const { data } = await (admin as any)
    .from('apt_sites')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  return data as { id: number; slug: string; name: string } | null;
}

/**
 * 바이트 → webp 변환 → apt-covers 업로드 → apt_sites 3필드 갱신.
 * multipart 경로와 URL 경로가 이 함수 하나를 공유한다.
 */
async function storeCover(
  admin: Admin,
  site: { id: number; slug: string; name: string },
  input: Buffer,
  credit: string,
): Promise<NextResponse> {
  let webp: Buffer;
  try {
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

/* ──────────────────────────── URL 수집 경로 ──────────────────────────── */

/**
 * 서버가 대신 받아오는 URL 의 최소 안전 검사.
 *
 * 호출자가 신뢰 범위(어드민 세션·머신 토큰) 안이어도, 서버가 임의 주소로 요청을 보내는
 * 경로는 그 자체가 내부망 탐색 수단이 된다. http(s) 외 스킴과 사설·루프백 대역을 막는다.
 * (DNS 리바인딩까지 막지는 못한다 — 호출자가 신뢰 범위라 여기까지가 비례하는 방어다.)
 */
function rejectUnsafeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'url 형식이 올바르지 않습니다';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return 'http(s) URL 만 받습니다';
  }
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isPrivate =
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.internal') ||
    h === '::1' ||
    h === '0.0.0.0' ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (isPrivate) return '사설·루프백 주소는 받을 수 없습니다';
  return null;
}

async function ingestFromUrl(req: NextRequest, admin: Admin): Promise<NextResponse> {
  let body: { slug?: string; url?: string; credit?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 올바르지 않습니다' }, { status: 400 });
  }

  const slug = (body.slug || '').trim();
  const credit = (body.credit || '').trim();
  const url = (body.url || '').trim();

  if (!slug) return NextResponse.json({ error: 'slug 가 필요합니다' }, { status: 400 });
  // 출처가 없으면 받아오지도 않는다. 허락 근거 없는 이미지가 쌓이는 것이 최대 리스크다.
  if (!credit) {
    return NextResponse.json({ error: '허락 출처(credit)는 필수입니다 (누구에게 어떤 형태로 받았는지)' }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: 'url 이 필요합니다' }, { status: 400 });

  const unsafe = rejectUnsafeUrl(url);
  if (unsafe) return NextResponse.json({ error: unsafe }, { status: 400 });

  const site = await findSite(admin, slug);
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다' }, { status: 404 });

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'image/*' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `이미지를 받아오지 못했습니다: ${e?.message ?? 'fetch 실패'}` }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `원본 응답 ${res.status}` }, { status: 502 });
  }

  // 이미지가 아니면 거절한다. HTML 오류 페이지를 sharp 에 넘기지 않는다.
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (!ctype.startsWith('image/')) {
    return NextResponse.json(
      { error: `이미지가 아닙니다 (content-type: ${ctype || '없음'})` },
      { status: 400 },
    );
  }

  // 헤더로 먼저 거르고, 실제 바이트로 한 번 더 확인한다 (헤더가 없거나 거짓일 수 있다).
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_INPUT) {
    return NextResponse.json({ error: `원본이 너무 큽니다 (${Math.round(declared / 1024 / 1024)}MB · 상한 25MB)` }, { status: 400 });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) return NextResponse.json({ error: '빈 응답입니다' }, { status: 400 });
  if (buf.length > MAX_INPUT) {
    return NextResponse.json({ error: `원본이 너무 큽니다 (${Math.round(buf.length / 1024 / 1024)}MB · 상한 25MB)` }, { status: 400 });
  }

  return storeCover(admin, site, buf, credit);
}

/* ─────────────────────────── multipart 업로드 경로 ─────────────────────────── */

async function uploadFromForm(req: NextRequest, admin: Admin): Promise<NextResponse> {
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
  if (!credit) {
    return NextResponse.json({ error: '허락 출처는 필수입니다 (누구에게 어떤 형태로 받았는지)' }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: '이미지 파일이 없습니다' }, { status: 400 });
  }
  if (file.size > MAX_INPUT) {
    return NextResponse.json({ error: `원본이 너무 큽니다 (${Math.round(file.size / 1024 / 1024)}MB · 상한 25MB)` }, { status: 400 });
  }

  const site = await findSite(admin, slug);
  if (!site) return NextResponse.json({ error: '현장을 찾을 수 없습니다' }, { status: 404 });

  return storeCover(admin, site, Buffer.from(await file.arrayBuffer()), credit);
}

/* ──────────────────────────────── 핸들러 ──────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await sessionOnly();
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
  const ctype = (req.headers.get('content-type') || '').toLowerCase();

  // JSON = URL 수집. 세션 또는 머신 토큰 (pg_net 직접 호출용).
  if (ctype.includes('application/json')) {
    const auth = await sessionOrMachine(req);
    if ('error' in auth) return auth.error;
    return ingestFromUrl(req, auth.admin);
  }

  // multipart = 사람이 파일을 올리는 경로. 세션 전용 — 머신 토큰을 열지 않는다.
  const auth = await sessionOnly();
  if ('error' in auth) return auth.error;
  return uploadFromForm(req, auth.admin);
}

export async function DELETE(req: NextRequest) {
  const auth = await sessionOnly();
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

  const site = await findSite(admin, slug);
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
