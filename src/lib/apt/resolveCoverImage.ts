/**
 * resolveCoverImage
 *
 * 단지 대표 이미지 on-demand resolver.
 * 페이지 SSR 중 이미지 없는 단지 발견 시 호출. 카카오맵 위성뷰 fetch & Supabase Storage 업로드.
 * fire-and-forget 패턴: 절대 throw하지 않음, 페이지 응답 차단 X.
 *
 * 첫 방문자는 InitialPlaceholder, 다음 방문자(ISR 10분 후)는 사진 노출.
 *
 * Architecture Rule #13: (sb as any).from() 패턴 유지.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

type AptSiteRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  cover_image_url: string | null;
  cover_image_kind: string | null;
  cover_image_resolved_at: string | null;
};

/**
 * 한 단지의 대표 이미지를 백그라운드에서 resolve.
 * fire-and-forget — 호출자는 await 하지 말고 `void resolveCoverImageInBackground(id)`.
 */
export async function resolveCoverImageInBackground(siteId: string): Promise<void> {
  // 어떤 에러도 페이지 응답 차단 X
  try {
    await resolveInternal(siteId);
  } catch (err) {
    console.error('[resolveCoverImage] failed:', siteId, err);
  }
}

async function resolveInternal(siteId: string): Promise<void> {
  const sb = getSupabaseAdmin();

  // 1. 단지 조회
  const { data: site, error: fetchErr } = await (sb as any)
    .from('apt_sites')
    .select('id, name, lat, lng, cover_image_url, cover_image_kind, cover_image_resolved_at')
    .eq('id', siteId)
    .single();

  if (fetchErr || !site) {
    return;
  }

  const row = site as AptSiteRow;

  // 2. 이미 official 이미지가 있으면 skip
  if (row.cover_image_kind === 'official') {
    return;
  }

  // 3. 최근 1시간 내에 이미 시도했으면 skip (재시도 폭주 방지)
  if (row.cover_image_resolved_at) {
    const lastTry = new Date(row.cover_image_resolved_at).getTime();
    if (Date.now() - lastTry < 60 * 60 * 1000) {
      return;
    }
  }

  // resolved_at 즉시 갱신 (다른 동시 호출 방지)
  await (sb as any)
    .from('apt_sites')
    .update({ cover_image_resolved_at: new Date().toISOString() })
    .eq('id', siteId);

  // 4. lat/lng 있으면 카카오 위성뷰 fetch
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !row.lat || !row.lng) {
    return;
  }

  const staticMapUrl =
    `https://dapi.kakao.com/v2/maps/staticmap?` +
    `appkey=${apiKey}&` +
    `mapType=SKYVIEW&` +
    `level=3&` +
    `center=${row.lng},${row.lat}&` +
    `size=1200x675`;

  const imageRes = await fetch(staticMapUrl, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!imageRes.ok) {
    console.warn('[resolveCoverImage] kakao fetch failed:', siteId, imageRes.status);
    return;
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer());

  if (buffer.length < 1000) {
    // suspiciously small response, skip
    return;
  }

  // 5. Storage 업로드
  const path = `${siteId}/satellite_${Date.now()}.jpg`;
  const { error: uploadErr } = await sb.storage
    .from('apt-covers')
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      cacheControl: '604800',
      upsert: false,
    });

  if (uploadErr) {
    console.warn('[resolveCoverImage] upload failed:', siteId, uploadErr.message);
    return;
  }

  const { data: pub } = sb.storage.from('apt-covers').getPublicUrl(path);
  const publicUrl = pub?.publicUrl;

  if (!publicUrl) {
    return;
  }

  // 6. apt_sites 업데이트
  await (sb as any)
    .from('apt_sites')
    .update({
      cover_image_url: publicUrl,
      cover_image_kind: 'satellite',
      cover_image_source: '카카오맵 위성뷰',
      cover_image_resolved_at: new Date().toISOString(),
    })
    .eq('id', siteId);
}

/**
 * 페이지 데이터 fetch 결과에서 이미지 없는 단지들을 골라 백그라운드 resolve 트리거.
 * 페이지 응답을 막지 않음.
 */
export function triggerMissingCoverResolution<
  T extends { id: string; cover_image_url: string | null; cover_image_kind: string | null }
>(items: { site: T }[] | T[]): void {
  const sites: T[] = (items as any[]).map((it) => (it.site ? it.site : it));
  for (const s of sites) {
    if (!s.cover_image_url || s.cover_image_kind === null) {
      void resolveCoverImageInBackground(s.id);
    }
  }
}
