// ✅ 전략기획팀 요청: 실시간 인기 키워드 집계 Edge Function
// Supabase Cron Job으로 1분마다 실행
// 열기 지수(Heatmap Score) = views*1 + likes*3 + comments*5 + shares*8 / (1 + hours^1.5)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 인증 검증 (CRON_SECRET 또는 service_role)
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      // Allow service_role calls
      if (!authHeader?.includes(serviceKey)) {
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 최근 24시간 인기 게시글 기반 키워드 추출
    const { data: hotPosts } = await supabase
      .from("posts")
      .select("title, view_count, like_count, comment_count, share_count, created_at")
      .gte("created_at", twentyFourHoursAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (!hotPosts || hotPosts.length === 0) {
      return new Response(JSON.stringify({ message: "No recent posts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 키워드 추출 + 스코어 계산
    const keywordScores: Record<string, number> = {};

    for (const post of hotPosts) {
      const hoursElapsed = (now.getTime() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
      const rawScore =
        post.view_count * 1.0 +
        post.like_count * 3.0 +
        post.comment_count * 5.0 +
        post.share_count * 8.0;
      const decayedScore = rawScore / (1 + Math.pow(hoursElapsed, 1.5));

      // 간단한 키워드 추출 (2글자 이상 한글 단어)
      const words = post.title.match(/[가-힣A-Za-z0-9]{2,}/g) || [];
      const stopwords = new Set(["그리고", "하지만", "그래서", "때문에", "대해서", "입니다", "합니다", "있는", "없는", "하는"]);
      
      for (const word of words) {
        if (!stopwords.has(word)) {
          keywordScores[word] = (keywordScores[word] || 0) + decayedScore;
        }
      }
    }

    // 상위 20개 키워드 저장
    const topKeywords = Object.entries(keywordScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    // 기존 데이터 삭제 후 새로 삽입
    await supabase.from("trending_keywords").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (topKeywords.length > 0) {
      await supabase.from("trending_keywords").insert(
        topKeywords.map(([keyword, score]) => ({
          keyword,
          heat_score: Math.round(score * 100) / 100,
          category: null,
        }))
      );
    }

    return new Response(
      JSON.stringify({ updated: topKeywords.length, top3: topKeywords.slice(0, 3).map(([k]) => k) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
