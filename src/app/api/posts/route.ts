import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const category = searchParams.get("category");
    let query = supabase.from("posts").select(`id, title, content, created_at, category, likes_count, comments_count, view_count, author_id, images, is_anonymous, tag, slug, author:profiles!posts_author_id_fkey(id, nickname, avatar_url)`, { count: "exact" }).eq("is_deleted", false).order("created_at", { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (category) query = query.eq("category", category);
    const { data, error, count } = await query;
    if (error) { console.error("[Posts GET]", error); return NextResponse.json({ error: "게시글을 불러올 수 없습니다." }, { status: 500 }); }
    return NextResponse.json({ posts: data || [], total: count || 0, page, limit, hasMore: (count || 0) > page * limit });
  } catch (err) { console.error("[Posts GET]", err); return NextResponse.json({ error: "서버 오류" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = await req.json();
    const title = sanitizeText(body.title, 200); const content = sanitizeText(body.content, 10000); const category = sanitizeText(body.category, 50);
    if (!title || title.length < 2) return NextResponse.json({ error: "제목은 2자 이상이어야 합니다." }, { status: 400 });
    if (!content || content.length < 5) return NextResponse.json({ error: "내용은 5자 이상이어야 합니다." }, { status: 400 });
    const { data, error } = await supabase.from("posts").insert({ title, content, category: category || null, author_id: user.id, is_anonymous: body.is_anonymous ?? false, tag: sanitizeText(body.tag, 50) || null }).select().single();
    if (error) { console.error("[Posts POST]", error); return NextResponse.json({ error: "게시글 작성에 실패했습니다." }, { status: 500 }); }
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (err) { console.error("[Posts POST]", err); return NextResponse.json({ error: "서버 오류" }, { status: 500 }); }
}
