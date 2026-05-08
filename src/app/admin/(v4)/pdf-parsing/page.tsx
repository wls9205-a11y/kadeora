// app/admin/(v4)/pdf-parsing/page.tsx — s258
import { createClient } from "@supabase/supabase-js";
import PdfParsingHeatmap from "@/components/admin/v4/PdfParsingHeatmap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: matrix } = await supabase
    .from("v_admin_pdf_parsing_health")
    .select("*");

  const { count: totalWithUrl } = await supabase
    .from("apt_subscriptions")
    .select("id", { count: "exact", head: true })
    .not("announcement_pdf_url", "is", null);

  // 거짓 성공 건수 = matrix 의 false_success_count 합
  const falseSuccess = (matrix ?? []).reduce(
    (s: number, r: any) => s + (r.false_success_count ?? 0),
    0,
  );

  return { matrix: matrix ?? [], totalWithUrl: totalWithUrl ?? 0, falseSuccess };
}

export default async function PdfParsingPage() {
  const { matrix, totalWithUrl, falseSuccess } = await getData();
  const totalProcessed = matrix.reduce((s: number, r: any) => s + (r.cnt ?? 0), 0);
  const realSuccess = matrix
    .filter((r: any) => r.parse_version === 1 && r.raw_band !== "null" && r.raw_band !== "<100")
    .reduce((s: number, r: any) => s + (r.cnt ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">PDF 파싱 헬스</h1>
        <p className="text-sm text-gray-500">
          분양공고 PDF 텍스트 추출 + 평당가/요약 추출 진행 상태.
        </p>
      </header>
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">PDF URL 보유</div>
          <div className="text-3xl font-bold">{totalWithUrl}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500">파싱 시도</div>
          <div className="text-3xl font-bold">{totalProcessed}</div>
        </div>
        <div className="rounded-lg border p-4 border-emerald-200">
          <div className="text-xs text-emerald-600">실제 성공 (raw≥100자)</div>
          <div className="text-3xl font-bold text-emerald-600">{realSuccess}</div>
        </div>
        <div
          className={`rounded-lg border p-4 ${
            falseSuccess > 0 ? "border-red-200 bg-red-50" : "border-emerald-200"
          }`}
        >
          <div className="text-xs text-red-600">거짓 성공</div>
          <div className="text-3xl font-bold text-red-600">{falseSuccess}</div>
          <div className="text-xs text-gray-500">version=1 + raw NULL</div>
        </div>
      </div>
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">parse_version × raw_text 길이 매트릭스</h2>
        <PdfParsingHeatmap rows={matrix as any[]} />
      </section>
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-3">상세 매트릭스</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">parse_version</th>
              <th className="p-2">raw 길이</th>
              <th className="p-2 text-right">cnt</th>
              <th className="p-2 text-right">has_price</th>
              <th className="p-2 text-right">has_summary</th>
              <th className="p-2 text-right">false_success</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((r: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="p-2 font-mono text-xs">
                  {r.parse_version === 1
                    ? "✅ 1 (success)"
                    : r.parse_version === -1
                    ? "❌ -1 (failed)"
                    : r.parse_version}
                </td>
                <td className="p-2 font-mono text-xs">{r.raw_band}</td>
                <td className="p-2 text-right tabular-nums">{r.cnt}</td>
                <td className="p-2 text-right tabular-nums">{r.has_price ?? 0}</td>
                <td className="p-2 text-right tabular-nums">
                  {r.has_summary ?? 0}
                </td>
                <td
                  className={`p-2 text-right tabular-nums ${
                    r.false_success_count > 0 ? "text-red-600 font-bold" : ""
                  }`}
                >
                  {r.false_success_count ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
