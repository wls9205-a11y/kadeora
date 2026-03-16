import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async () => {
  const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'https://kadeora.app';
  const secret = Deno.env.get('CRON_SECRET') || '';

  try {
    const res = await fetch(`${siteUrl}/api/stock-refresh`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), result: data }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
