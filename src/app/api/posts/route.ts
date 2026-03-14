import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAppError, logError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit("api", ip);
  if (!allowed) {
    const err = createAppError("RATE_LIMITED", { ip });
    return NextResponse.json(errorResponse(err).error, { status: err.statusCode, headers: { "Retry-After": "60" } });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20")), 50);

  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("posts")
      .select("id, title, content, category, view_count, likes_count, comments_count, created_at, profiles(nickname, avatar_url)", { count: "exact" })
      
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (category && category !== "all") query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ posts: data || [], total: count || 0, page, limit });
  } catch (err) {
    logError(err, { route: "GET /api/posts", category, page });
    const appErr = createAppError("DB_ERROR");
    return NextResponse.json(errorResponse(appErr).error, { status: appErr.statusCode });
  }
}
