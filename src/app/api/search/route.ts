import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ error:"검색어를 입력해주세요." }, { status:400 });
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("posts").select("id,title,content,category,view_count,likes_count,comments_count,created_at,profiles(nickname,avatar_url)",{count:"exact"}).eq("is_deleted",false).or("title.ilike.%"+q+"%,content.ilike.%"+q+"%").order("created_at",{ascending:false}).limit(30);
    if (error) return NextResponse.json({ error:"검색 실패" }, { status:500 });
    return NextResponse.json({ data:data||[], query:q });
  } catch { return NextResponse.json({ error:"서버 오류" }, { status:500 }); }
}
