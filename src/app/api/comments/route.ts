import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { sanitizePlainText } from "@/lib/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseInput, CommentCreateSchema } from "@/lib/schemas";
import { createAppError, logError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit("api", ip);
  if (!allowed) {
    const err = createAppError("RATE_LIMITED");
    return NextResponse.json(errorResponse(err).error, { status: err.statusCode });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const err = createAppError("AUTH_REQUIRED");
      return NextResponse.json(errorResponse(err).error, { status: err.statusCode });
    }

    const body = await request.json();
    const parsed = parseInput(CommentCreateSchema, body);
    if (!parsed.success) {
      const err = createAppError("VALIDATION_ERROR", { errors: parsed.errors });
      return NextResponse.json({ ...errorResponse(err).error, details: parsed.errors }, { status: err.statusCode });
    }

    const content = sanitizePlainText(parsed.data.content).trim();

    const { data, error } = await supabase.from("comments").insert({
      post_id: parsed.data.postId,
      author_id: user.id,
      content,
      parent_id: parsed.data.parentId || null,
    }).select("*").single();

    if (error) throw error;
    return NextResponse.json({ comment: data });
  } catch (err) {
    logError(err, { route: "POST /api/comments" });
    const appErr = createAppError("DB_ERROR");
    return NextResponse.json(errorResponse(appErr).error, { status: appErr.statusCode });
  }
}
