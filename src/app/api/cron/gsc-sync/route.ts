/**
 * 세션 146 A1 / 세션 153 컬럼명 / 세션 154 토큰 갱신 로직.
 *
 * 세션 154 변경:
 * - env clientId/secret 없어도 DB fallback 으로 진행
 * - refreshAccessToken 이 expires_in 까지 반환
 * - oauth_tokens UPDATE (access_token, access_token_expires_at, refresh_count+1, last_refreshed_at, last_error)
 * - access_token 유효하면 재갱신 생략
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

const SITE_URL = process.env.GSC_SITE_URL || 'https://kadeora.app';

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) {
      // s258 patch #7: refresh_token 만료 시 명시적 에러 메시지 (silent null 회복)
      let body = '';
      try { body = await res.text(); } catch {}
      console.error(`[gsc-sync] oauth_refresh_failed_${res.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const body = await res.json();
    if (!body?.access_token) return null;
    return { token: body.access_token, expiresIn: Number(body.expires_in) || 3600 };
  } catch (e: any) {
    console.error('[gsc-sync] refresh exception', String(e?.message).slice(0, 200));
    return null;
  }
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return new NextResponse('ok', { status: 200 });

  const sb = getSupabaseAdmin();
  // 세션 153 컬럼명 + 154: access_token + expires + client creds 전부 조회
  const { data: token } = await (sb as any)
    .from('oauth_tokens')
    .select('refresh_token, access_token, access_token_expires_at, client_id, client_secret')
    .eq('provider', 'gsc')
    .maybeSingle();

  if (!token?.refresh_token) {
    return NextResponse.json({ ok: true, skipped: 'no_gsc_refresh_token' });
  }

  // env 값 우선, 없으면 DB 저장 값 fallback
  const effClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || token.client_id;
  const effClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || token.client_secret;
  if (!effClientId || !effClientSecret) {
    return NextResponse.json({ ok: true, skipped: 'no_google_oauth_creds' });
  }

  // access_token 유효 여부 확인 (30초 버퍼)
  let access: string | null = null;
  const now = Date.now();
  const expAt = token.access_token_expires_at ? new Date(token.access_token_expires_at).getTime() : 0;
  if (token.access_token && expAt > now + 30_000) {
    access = token.access_token;
  } else {
    const refreshed = await refreshAccessToken(effClientId, effClientSecret, token.refresh_token);
    if (!refreshed) {
      // UPDATE last_error 기록
      await (sb as any).from('oauth_tokens').update({
        last_error: 'access_token_refresh_failed',
        last_error_at: new Date().toISOString(),
      }).eq('provider', 'gsc');
      return NextResponse.json({ ok: true, skipped: 'access_token_refresh_failed' });
    }
    access = refreshed.token;
    // UPDATE oauth_tokens — 새 access_token 저장
    const newExp = new Date(now + refreshed.expiresIn * 1000).toISOString();
    const { data: cur } = await (sb as any).from('oauth_tokens').select('refresh_count').eq('provider', 'gsc').maybeSingle();
    await (sb as any).from('oauth_tokens').update({
      access_token: access,
      access_token_expires_at: newExp,
      last_refreshed_at: new Date().toISOString(),
      refresh_count: (cur?.refresh_count || 0) + 1,
      last_error: null,
      last_error_at: null,
      updated_at: new Date().toISOString(),
    }).eq('provider', 'gsc');
  }

  // 3일 전부터 어제까지 (GSC 지연 반영)
  const end = new Date(Date.now() - 2 * 24 * 3600_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - 5 * 24 * 3600_000).toISOString().slice(0, 10);

  /**
   * ── 2026-08-25 · 4개월 공백(2026-04-22 이후)의 원인 ──
   *
   * 실측: OAuth 는 정상이다(어제 19:17 갱신 성공, last_error 없음). API 도 4xx 를 내지 않는다.
   * 그런데 응답이 `rows: 0` 이다 — 즉 **속성은 열리는데 그 속성에 데이터가 없다.**
   *
   * GSC 속성은 두 종류이고 **서로 다른 데이터**를 갖는다:
   *   URL 접두어  `https://kadeora.app/`   ← 지금 코드가 보던 것
   *   도메인      `sc-domain:kadeora.app`
   * 도메인 속성으로 옮겨 재인증하면 URL 접두어 속성은 살아 있되 0행이 된다.
   * 잘못된 속성이면 보통 403 이지만, **존재하되 비어 있으면 200 + 0행**이라 조용하다.
   *
   * → 지정 속성이 0행이면 **접근 가능한 속성 목록을 실제로 조회해** 같은 호스트의
   *   다른 속성으로 한 번 재시도하고, 무엇을 썼는지 응답에 남긴다.
   *   추측으로 상수를 바꾸지 않는다 — 다음 사람이 또 4개월을 잃지 않게 한다.
   */
  const queryGsc = async (property: string) => {
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ['date', 'query', 'page', 'device', 'country'],
        rowLimit: 25000,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('[gsc-sync] api fail', property, res.status, txt.slice(0, 300));
      return { ok: false as const, status: res.status };
    }
    const body = await res.json();
    return { ok: true as const, rows: (body?.rows || []) as any[] };
  };

  /** 이 계정이 실제로 접근 가능한 속성 목록. 추측 대신 물어본다. */
  const listProperties = async (): Promise<string[]> => {
    try {
      const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!res.ok) return [];
      const body = await res.json();
      return ((body?.siteEntry || []) as any[])
        .map((s) => String(s?.siteUrl || ''))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  try {
    let usedProperty = SITE_URL;
    let availableProperties: string[] | undefined;

    let attempt = await queryGsc(usedProperty);
    if (!attempt.ok) {
      availableProperties = await listProperties();
      return NextResponse.json({
        ok: true,
        skipped: `gsc_api_${attempt.status}`,
        property: usedProperty,
        available_properties: availableProperties,
      });
    }

    if (attempt.rows.length === 0) {
      // 0행이면 속성이 비었을 수 있다. 같은 호스트의 다른 속성을 딱 한 번 시도한다.
      availableProperties = await listProperties();
      const host = SITE_URL.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const alt = availableProperties.find(
        (p) =>
          p !== usedProperty &&
          p.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '') === host,
      );
      if (alt) {
        const retry = await queryGsc(alt);
        if (retry.ok && retry.rows.length > 0) {
          usedProperty = alt;
          attempt = retry;
        }
      }
    }

    const rows = attempt.rows;

    let inserted = 0;
    let failedBatches = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const payload = batch.map((r) => ({
        date: r.keys[0],
        query: (r.keys[1] || '').slice(0, 300),
        page: (r.keys[2] || '').slice(0, 500),
        device: r.keys[3] || null,
        country: r.keys[4] || null,
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));
      const { error } = await (sb as any).from('gsc_search_analytics').insert(payload);
      if (error) {
        // 삼키면 적재가 전부 실패해도 응답은 ok:true 고 런타임 로그에 아무것도 안 남는다.
        failedBatches++;
        console.error('[gsc-sync] insert fail', error.message?.slice(0, 200));
      } else {
        inserted += payload.length;
      }
    }

    return NextResponse.json({
      ok: true,
      date_range: [start, end],
      property: usedProperty,
      // 0행일 때만 채워진다. 어떤 속성이 열려 있는지 보이면 원인이 바로 잡힌다.
      ...(availableProperties ? { available_properties: availableProperties } : {}),
      rows: rows.length,
      inserted,
      failed_batches: failedBatches,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: true, skipped: 'exception', err: String(e?.message || '').slice(0, 120) });
  }
}

export const GET = handler;
export const POST = handler;
