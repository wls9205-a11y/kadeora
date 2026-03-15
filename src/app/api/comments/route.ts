import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error:"로그인이 필요합니다." }, { status:401 });
    const body = await request.json();
    const { post_id, content } = body;
    if (!post_id||!content?.trim()) return NextResponse.json({ error:"내용을 입력해주세요." }, { status:400 });
    const { data:comment, error:e } = await supabase.from("comments").insert({ post_id, user_id:user.id, content:content.trim(), is_deleted:false }).select("id,content,created_at,profiles(nickname,avatar_url)").single();
    if (e) return NextResponse.json({ error:"댓글 작성 실패" }, { status:500 });
    const { data:cur } = await supabase.from("posts").select("comments_count").eq("id",post_id).single();
    if (cur) await supabase.from("posts").update({ comments_count:(cur.comments_count||0)+1 }).eq("id",post_id);
    return NextResponse.json({ data:comment }, { status:201 });
  } catch { return NextResponse.json({ error:"서버 오류" }, { status:500 }); }
}
