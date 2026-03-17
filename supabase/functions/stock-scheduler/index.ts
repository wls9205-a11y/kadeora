import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async () => {
  const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'https://kadeora.app';
  const secret = Deno.env.get('CRON_SECRET') || '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25초 타임아웃

    const res = await fetch(`${siteUrl}/api/stock-refresh`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // 응답이 JSON이 아닐 수 있음 (HTML 에러 페이지 등)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return new Response(JSON.stringify({
        ok: false,
        status: res.status,
        error: `Non-JSON response: ${text.slice(0, 200)}`,
        timestamp: new Date().toISOString(),
      }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        status: res.status,
        error: data.error ?? 'stock-refresh returned error',
        timestamp: new Date().toISOString(),
      }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      source: data.source ?? 'unknown',
      updated: data.updated ?? 0,
      success: data.success ?? 0,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.includes('abort') || message.includes('timeout');

    return new Response(JSON.stringify({
      ok: false,
      error: isTimeout ? 'Request timeout (25s)' : message,
      hint: isTimeout
        ? 'stock-refresh API가 25초 내 응답하지 않았습니다. Vercel cold start 또는 Yahoo Finance 지연일 수 있습니다.'
        : 'CRON_SECRET 또는 NEXT_PUBLIC_SITE_URL 환경변수를 확인하세요.',
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
