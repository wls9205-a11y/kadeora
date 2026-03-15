import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.rpc("refresh_trending_keywords");
    if (error) { console.error("[Trend]", error); return NextResponse.json({ error: "트렌딩 갱신 실패" }, { status: 500 }); }
    return NextResponse.json({ success: true });
  } catch (err) { console.error("[Trend]", err); return NextResponse.json({ error: "서버 오류" }, { status: 500 }); }
}
