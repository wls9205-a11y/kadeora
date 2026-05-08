// app/admin/(v4)/carousel-eligibility/page.tsx — s258
import { createClient } from "@supabase/supabase-js";
import CarouselDistribution from "@/components/admin/v4/CarouselDistribution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: byCategory } = await supabase
    .from("v_admin_carousel_eligibility")
    .select("*");
  // position 분포 (전체)
  const { data: positionRows } = await supabase
    .from("blog_post_images")
    .select('"position"')
    .limit(50000);
  const posDist = new Array(16).fill(0);
  for (const r of positionRows ?? []) {
    const p = (r as any).position;
    if (p >= 0 && p <= 15) posDist[p]++;
  }
  return { byCategory: byCategory ?? [], posDist };
}

export default async function CarouselPage() {
  const { byCategory, posDist } = await getData();
  const total = byCategory.reduce((s: number, r: any) => s + (r.total_posts ?? 0), 0);
  const eligible = byCategory.reduce(
    (s: number, r: any) => s + (r.carousel_eligible_5plus ?? 0),
    0,
  );
  const totalImgPct = total > 0 ? Math.round((eligible / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">캐러셀 적격성 (이미지 5장+)</h1>
        <p className="text-sm text-gray-500">
          네이버 검색 이미지 캐러셀 노출은 본문 이미지 5장 이상이 권장됩니다.
        </p>
      </header>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">발행 글 총합</div>
          <div className="text-3xl font-bold">{total.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border p-4 border-emerald-200">
          <div className="text-xs text-emerald-600">캐러셀 적격 (5장+)</div>
          <div className="text-3xl font-bold text-emerald-600">
            {eligible.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">적격 비율</div>
          <div className="text-3xl font-bold">{totalImgPct}%</div>
        </div>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">position 분포 (0~15)</h2>
        <CarouselDistribution posDist={posDist} />
        <div className="mt-2 text-xs text-gray-500">
          정상 분포: 0번부터 1번 → 2번 ... 순으로 자연 감소. position 7 또는 15에 비정상적으로 몰리면 INSERT 로직 버그.
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">카테고리별 적격성</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">category</th>
              <th className="p-2 text-right">posts</th>
              <th className="p-2 text-right">img≥1</th>
              <th className="p-2 text-right">img≥3</th>
              <th className="p-2 text-right">img≥5</th>
              <th className="p-2 text-right">img≥8</th>
              <th className="p-2 text-right">avg img</th>
              <th className="p-2 text-right">avg relevance</th>
              <th className="p-2 text-right">eligible %</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((r: any) => (
              <tr key={r.category} className="border-t">
                <td className="p-2 font-mono text-xs">{r.category}</td>
                <td className="p-2 text-right tabular-nums">{r.total_posts}</td>
                <td className="p-2 text-right tabular-nums">{r.img_1plus}</td>
                <td className="p-2 text-right tabular-nums">{r.img_3plus}</td>
                <td className="p-2 text-right tabular-nums">
                  {r.carousel_eligible_5plus}
                </td>
                <td className="p-2 text-right tabular-nums">{r.img_8plus}</td>
                <td className="p-2 text-right tabular-nums">{r.avg_img_count}</td>
                <td className="p-2 text-right tabular-nums">{r.avg_relevance}</td>
                <td className="p-2 text-right tabular-nums font-bold">
                  {r.eligible_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
