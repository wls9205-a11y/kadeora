import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const content = sanitizeText(body.content, 2000); const postId = body.post_id;
    if (!content || content.length < 1) return NextResponse.json({ error: "댓글 내용을 입력해주세요." }, { status: 400 });
    if (!postId) return NextResponse.json({ error: "게시글 ID가 필요합니다." }, { status: 400 });
    const { data, error } = await supabase.from("comments").insert({ content, post_id: postId, author_id: user.id }).select(`*, author:profiles!comments_author_id_fkey(id, nickname, avatar_url)`).single();
    if (error) { console.error("[Comments POST]", error); return NextResponse.json({ error: "댓글 작성에 실패했습니다." }, { status: 500 }); }
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) { console.error("[Comments POST]", err); return NextResponse.json({ error: "서버 오류" }, { status: 500 }); }
}
