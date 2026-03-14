import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logError, createAppError, errorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("trending_keywords")
      .select("*")
      .order("heat_score", { ascending: false })
      .limit(10);

    if (error) throw error;
    return NextResponse.json({ keywords: data }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    logError(err, { route: "GET /api/trend" });
    const appErr = createAppError("DB_ERROR");
    return NextResponse.json(errorResponse(appErr).error, { status: appErr.statusCode });
  }
}
