// app/admin/(v4)/seo-measurement/page.tsx — s258
import { createClient } from "@supabase/supabase-js";
import SeoHealthCard from "@/components/admin/v4/SeoHealthCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("v_admin_seo_measurement_health")
    .select("health")
    .single();
  return { health: (data as any)?.health ?? null };
}

export default async function SeoMeasurementPage() {
  const { health } = await getData();
  if (!health) {
    return <div className="p-6 text-sm text-gray-500">데이터 없음</div>;
  }

  const score: number = health.health_score ?? 0;
  const scoreColor =
    score >= 80
      ? "text-emerald-600"
      : score >= 50
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">SEO 측정 인프라 헬스</h1>
          <p className="text-sm text-gray-500">
            GSC · Naver SC · IndexNow · Naver Syndication · OG Cards 종합 점수.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">종합 점수</div>
          <div className={`text-5xl font-black ${scoreColor}`}>{score}</div>
          <div className="text-xs text-gray-500">/ 100</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <SeoHealthCard
          title="Google Search Console"
          health={
            health.gsc?.stale_days === null
              ? "no_data"
              : health.gsc.stale_days > 7
              ? "stale"
              : "ok"
          }
          metrics={[
            { label: "최신 sync", value: health.gsc?.last_date ?? "없음" },
            {
              label: "정체 일수",
              value:
                health.gsc?.stale_days !== null
                  ? `${health.gsc.stale_days}일`
                  : "-",
            },
            {
              label: "30d 노출",
              value: (health.gsc?.imp_30d ?? 0).toLocaleString(),
            },
            {
              label: "30d 클릭",
              value: (health.gsc?.clk_30d ?? 0).toLocaleString(),
            },
            {
              label: "평균 순위",
              value: health.gsc?.avg_pos_30d ?? "-",
            },
            {
              label: "CTR",
              value:
                health.gsc?.imp_30d > 0
                  ? `${((health.gsc.clk_30d / health.gsc.imp_30d) * 100).toFixed(2)}%`
                  : "-",
            },
          ]}
        />

        <SeoHealthCard
          title="Naver Search Advisor"
          health={health.naver?.last_date ? "ok" : "no_data"}
          metrics={[
            { label: "최신 sync", value: health.naver?.last_date ?? "❌ 데이터 없음" },
            {
              label: "30d 노출",
              value: (health.naver?.imp_30d ?? 0).toLocaleString(),
            },
            {
              label: "30d 클릭",
              value: (health.naver?.clk_30d ?? 0).toLocaleString(),
            },
            {
              label: "평균 순위",
              value: health.naver?.avg_pos_30d ?? "-",
            },
          ]}
          warning={
            !health.naver?.last_date
              ? "naver-sc-sync cron 등록 + NAVER_SC_* 환경변수 필요"
              : undefined
          }
        />

        <SeoHealthCard
          title="IndexNow Queue"
          health={
            health.indexnow?.pending > 1000
              ? "stale"
              : health.indexnow?.sent > 0
              ? "ok"
              : "no_data"
          }
          metrics={[
            {
              label: "pending",
              value: (health.indexnow?.pending ?? 0).toLocaleString(),
            },
            {
              label: "sent",
              value: (health.indexnow?.sent ?? 0).toLocaleString(),
            },
            {
              label: "failed",
              value: (health.indexnow?.failed ?? 0).toLocaleString(),
            },
            {
              label: "expired",
              value: (health.indexnow?.expired ?? 0).toLocaleString(),
            },
            {
              label: "가장 오래된 pending",
              value: health.indexnow?.oldest_pending
                ? new Date(health.indexnow.oldest_pending).toLocaleDateString("ko-KR")
                : "-",
            },
          ]}
        />

        <SeoHealthCard
          title="Naver Syndication"
          health={
            health.syndication?.new_24h > 0
              ? "ok"
              : health.syndication?.cafe_pub > 0
              ? "stale"
              : "no_data"
          }
          metrics={[
            {
              label: "blog 발행",
              value: (health.syndication?.blog_pub ?? 0).toLocaleString(),
            },
            {
              label: "cafe 발행",
              value: (health.syndication?.cafe_pub ?? 0).toLocaleString(),
            },
            {
              label: "24h 신규",
              value: health.syndication?.new_24h ?? 0,
            },
          ]}
        />

        <SeoHealthCard
          title="OG Cards 갱신"
          health={
            health.og_cards?.fresh_7d > health.og_cards?.total_pub * 0.5
              ? "ok"
              : "stale"
          }
          metrics={[
            {
              label: "발행 글",
              value: (health.og_cards?.total_pub ?? 0).toLocaleString(),
            },
            {
              label: "og_cards 누락",
              value: (health.og_cards?.missing ?? 0).toLocaleString(),
            },
            {
              label: "7d 갱신",
              value: (health.og_cards?.fresh_7d ?? 0).toLocaleString(),
            },
            {
              label: "24h 갱신",
              value: (health.og_cards?.fresh_24h ?? 0).toLocaleString(),
            },
          ]}
        />
      </div>
    </div>
  );
}
