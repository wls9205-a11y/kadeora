import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizePlainText } from "@/lib/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseInput, SearchSchema } from "@/lib/schemas";
import { createAppError, logError, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit("search", ip);
  if (!allowed) {
    const err = createAppError("RATE_LIMITED");
    return NextResponse.json(errorResponse(err).error, { status: err.statusCode, headers: { "Retry-After": "60" } });
  }

  const query = sanitizePlainText(new URL(request.url).searchParams.get("q") || "").trim();
  const parsed = parseInput(SearchSchema, { q: query });
  if (!parsed.success) {
    return NextResponse.json({ results: [], total: 0 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, title, content, category, created_at, view_count, likes_count")
      .or(`title.ilike.%${parsed.data.q}%,content.ilike.%${parsed.data.q}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("consent_analytics").eq("id", user.id).single();
      if (profile?.consent_analytics === true) {
        await supabase.from("search_logs").insert({ user_id: user.id, query: parsed.data.q, results_count: posts?.length || 0, clicked_rank: null });
      }
    }

    return NextResponse.json({ results: posts || [], total: posts?.length || 0 });
  } catch (err) {
    logError(err, { route: "GET /api/search", query });
    const appErr = createAppError("DB_ERROR");
    return NextResponse.json(errorResponse(appErr).error, { status: appErr.statusCode });
  }
}
