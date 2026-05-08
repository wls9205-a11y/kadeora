// app/admin/(v4)/silent-fails/page.tsx — s258
import { createClient } from "@supabase/supabase-js";
import SilentFailTable from "@/components/admin/v4/SilentFailTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("v_admin_silent_fails_24h")
    .select("*")
    .order("fail_pct", { ascending: false, nullsFirst: false });

  // 최근 에러 샘플 (silent_fail 인 cron 들의 metadata.errors)
  const silentNames = (data ?? [])
    .filter((r: any) => r.health === "silent_fail")
    .map((r: any) => r.cron_name);
  const { data: samples } =
    silentNames.length > 0
      ? await supabase
          .from("cron_logs")
          .select("cron_name, metadata, error_message, started_at")
          .in("cron_name", silentNames)
          .gte(
            "started_at",
            new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          )
          .order("started_at", { ascending: false })
          .limit(40)
      : { data: [] };
  return { rows: data ?? [], samples: samples ?? [] };
}

export default async function SilentFailsPage() {
  const { rows, samples } = await getData();
  const silentCount = rows.filter((r: any) => r.health === "silent_fail").length;
  const allFailedCount = rows.filter((r: any) => r.health === "all_failed").length;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Silent Fails (24h)</h1>
        <p className="text-sm text-gray-500">
          status=&apos;success&apos; 인데 실패율 30% 이상이거나, 모든 실행이 실패인 cron 검출.
        </p>
      </header>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">전체 cron</div>
          <div className="text-3xl font-bold">{rows.length}</div>
        </div>
        <div className="rounded-lg border p-4 border-amber-200 bg-amber-50">
          <div className="text-xs text-amber-600">Silent Fail</div>
          <div className="text-3xl font-bold text-amber-600">{silentCount}</div>
        </div>
        <div className="rounded-lg border p-4 border-red-200 bg-red-50">
          <div className="text-xs text-red-600">All Failed</div>
          <div className="text-3xl font-bold text-red-600">{allFailedCount}</div>
        </div>
      </div>
      <SilentFailTable rows={rows as any[]} samples={samples as any[]} />
    </div>
  );
}
