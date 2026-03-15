import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";

export async function DELETE(req: NextRequest) {
  const rl = await checkRateLimit(req, "auth"); if (!rl.success) return rl.response;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await req.json();
    if (body.confirmation !== "계정을 삭제합니다") return NextResponse.json({ error: "확인 문구가 일치하지 않습니다." }, { status: 400 });
    const { error: profileError } = await supabase.from("profiles").update({ nickname: `deleted_${user.id.slice(0, 8)}`, avatar_url: null, bio: null, is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", user.id);
    if (profileError) { console.error("[Account DEL]", profileError); return NextResponse.json({ error: "계정 삭제 처리 중 오류" }, { status: 500 }); }
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: authDelErr } = await admin.auth.admin.deleteUser(user.id);
    if (authDelErr) console.error("[Account DEL] Auth:", authDelErr);
    return NextResponse.json({ success: true, message: "계정이 삭제되었습니다." });
  } catch (err) { console.error("[Account DEL]", err); return NextResponse.json({ error: "서버 오류" }, { status: 500 }); }
}
