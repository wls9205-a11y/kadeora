import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const start = Date.now();
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - start;
    return Response.json({
      status: error ? 'degraded' : 'ok',
      db: error ? 'error' : 'connected',
      latency_ms: latency,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    }, { status: error ? 503 : 200 });
  } catch {
    return Response.json({ status: 'error', db: 'disconnected', timestamp: new Date().toISOString() }, { status: 503 });
  }
}
