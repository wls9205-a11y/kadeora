import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error:"로그인이 필요합니다." }, { status:401 });
    const { title, content, category } = await request.json();
    if (!title?.trim()||!content?.trim()||!category) return NextResponse.json({ error:"모든 필드를 입력해주세요." }, { status:400 });
    const { data:post, error:e } = await supabase.from("posts").insert({ user_id:user.id, title:title.trim(), content:content.trim(), category, view_count:0, likes_count:0, comments_count:0, is_deleted:false }).select("id,title").single();
    if (e) return NextResponse.json({ error:"작성 실패" }, { status:500 });
    return NextResponse.json({ data:post }, { status:201 });
  } catch { return NextResponse.json({ error:"서버 오류" }, { status:500 }); }
}
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error:"로그인 필요" }, { status:401 });
    const postId = new URL(request.url).searchParams.get("id");
    if (!postId) return NextResponse.json({ error:"ID 필요" }, { status:400 });
    const { data:post } = await supabase.from("posts").select("user_id").eq("id",postId).single();
    if (!post||post.user_id!==user.id) return NextResponse.json({ error:"권한 없음" }, { status:403 });
    await supabase.from("posts").update({ is_deleted:true }).eq("id",postId);
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ error:"서버 오류" }, { status:500 }); }
}
