import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { parseInput, BugReportSchema } from "@/lib/schemas";
import { createAppError, logError, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = await checkRateLimit("bugReport", ip);
  if (!allowed) {
    const err = createAppError("RATE_LIMITED");
    return NextResponse.json(errorResponse(err).error, { status: err.statusCode });
  }

  try {
    const body = await request.json();
    const parsed = parseInput(BugReportSchema, body);
    if (!parsed.success) {
      const err = createAppError("VALIDATION_ERROR", { errors: parsed.errors });
      return NextResponse.json({ ...errorResponse(err).error, details: parsed.errors }, { status: err.statusCode });
    }

    const title = sanitizePlainText(parsed.data.title).trim();
    const content = sanitizePlainText(parsed.data.content).trim();
    const severity = classifySeverity(title, content);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.from("posts").insert({
      author_id: user?.id || null,
      title: `[버그] ${title}`,
      content,
      category: "bug",
      region_id: "",
      images: [],
    }).select("id").single();

    if (error) throw error;

    if (severity === "security") {
      logError(new Error("Security bug reported"), { postId: data.id, title, severity });
    }

    return NextResponse.json({ id: data.id, severity, message: "버그 제보가 접수되었습니다." });
  } catch (err) {
    logError(err, { route: "POST /api/bug-report" });
    const appErr = createAppError("INTERNAL_ERROR");
    return NextResponse.json(errorResponse(appErr).error, { status: appErr.statusCode });
  }
}

function classifySeverity(title: string, content: string): string {
  const t = `${title} ${content}`.toLowerCase();
  if (["보안", "해킹", "취약점", "인증", "토큰", "개인정보", "유출", "xss", "sql"].some((k) => t.includes(k))) return "security";
  if (["데이터", "삭제", "손실", "결제", "환불"].some((k) => t.includes(k))) return "data";
  if (["오류", "에러", "작동", "안됨", "불가", "실패"].some((k) => t.includes(k))) return "functional";
  return "ui";
}
