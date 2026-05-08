// app/admin/(v4)/pipeline-health/page.tsx — s258
import { createClient } from "@supabase/supabase-js";
import PipelineSankey from "@/components/admin/v4/PipelineSankey";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: pipeline } = await supabase
    .from("v_admin_pipeline_health")
    .select("*");
  const { data: cronLimit } = await supabase
    .from("blog_publish_config")
    .select("daily_create_limit, hourly_create_limit, daily_limit_by_type")
    .eq("id", 1)
    .single();
  // 오늘 cron_type 별 카운트
  const { data: todayPosts } = await supabase
    .from("blog_posts")
    .select("cron_type")
    .gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
  const counts: Record<string, number> = {};
  for (const p of todayPosts ?? []) {
    counts[p.cron_type as string] = (counts[p.cron_type as string] || 0) + 1;
  }
  return { pipeline: pipeline ?? [], cronLimit, counts };
}

export default async function PipelineHealthPage() {
  const { pipeline, cronLimit, counts } = await getData();
  const totalCnt = pipeline.reduce((s: number, r: any) => s + (r.cnt ?? 0), 0);
  const publishedCnt = pipeline.reduce(
    (s: number, r: any) => s + (r.published ?? 0),
    0,
  );
  const publishedPct = totalCnt > 0 ? Math.round((publishedCnt / totalCnt) * 100) : 0;
  const limits = (cronLimit?.daily_limit_by_type as any) || {};

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">이슈 파이프라인 헬스 (24h)</h1>
        <p className="text-sm text-gray-500">
          이슈 감지 → 드래프트 → 이미지 → SEO → 발행 단계별 진행 상태와 차단 사유.
        </p>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">24h 이슈 감지</div>
          <div className="text-3xl font-bold">{totalCnt}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">발행 완료</div>
          <div className="text-3xl font-bold">{publishedCnt}</div>
          <div className="text-xs text-gray-500">{publishedPct}% 발행률</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">일일 한도 (글로벌)</div>
          <div className="text-3xl font-bold">
            {cronLimit?.daily_create_limit ?? "-"}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">시간당 한도</div>
          <div className="text-3xl font-bold">
            {cronLimit?.hourly_create_limit ?? "-"}
          </div>
        </div>
      </div>

      {/* cron_type 별 게이지 */}
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">오늘 cron_type 별 사용량 / 한도</h2>
        <div className="space-y-2">
          {Object.entries(limits).map(([k, lim]) => {
            const used = counts[k] || 0;
            const pct = Math.min(100, Math.round((used / Number(lim)) * 100));
            return (
              <div key={k} className="grid grid-cols-[180px_1fr_120px] items-center gap-2">
                <div className="text-sm font-mono">{k}</div>
                <div className="h-2 bg-gray-100 rounded">
                  <div
                    className={`h-2 rounded ${
                      pct >= 100
                        ? "bg-red-500"
                        : pct >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-right tabular-nums">
                  {used} / {String(lim)} <span className="text-gray-400">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sankey 차트 (client) */}
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">차단 사유 분포</h2>
        <PipelineSankey rows={pipeline as any[]} />
      </section>

      {/* 상세 테이블 */}
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">lifecycle × decision × block 매트릭스</h2>
        <table className="w-full text-sm">
          <thead className="text-left bg-gray-50">
            <tr>
              <th className="p-2">lifecycle</th>
              <th className="p-2">publish_decision</th>
              <th className="p-2">block_reason</th>
              <th className="p-2 text-right">cnt</th>
              <th className="p-2 text-right">avg_score</th>
              <th className="p-2 text-right">published</th>
              <th className="p-2 text-right">draft_ts</th>
              <th className="p-2 text-right">img_ts</th>
              <th className="p-2 text-right">avg_min(감지→발행)</th>
            </tr>
          </thead>
          <tbody>
            {pipeline.map((r: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="p-2 font-mono text-xs">{r.lifecycle_stage}</td>
                <td className="p-2 font-mono text-xs">{r.publish_decision}</td>
                <td className="p-2 text-xs max-w-md truncate" title={r.block_reason}>
                  {r.block_reason}
                </td>
                <td className="p-2 text-right tabular-nums">{r.cnt}</td>
                <td className="p-2 text-right tabular-nums">{r.avg_final_score}</td>
                <td className="p-2 text-right tabular-nums">{r.published}</td>
                <td className="p-2 text-right tabular-nums">{r.draft_ts_filled}</td>
                <td className="p-2 text-right tabular-nums">{r.image_ts_filled}</td>
                <td className="p-2 text-right tabular-nums">
                  {r.avg_detect_to_pub_min ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
