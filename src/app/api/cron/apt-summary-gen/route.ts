// app/api/cron/apt-summary-gen/route.ts — s258 신규
// raw_text 가 채워진 apt_subscriptions 의 announcement_summary / price_per_pyeong 채움
// 정규식 휴리스틱 → 미달 시 Claude Haiku 호출 (배치)
// Architecture Rule #16: maxDuration=10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { logCronStart, logCronEnd } from "@/lib/cron-log";
import { extractPriceHeuristic } from "@/lib/pdf/parser";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const BATCH_SIZE = 8;     // Haiku 호출 비용 통제
const MIN_RAW_LEN = 500;  // 너무 짧은 raw_text는 처리 보류

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function summarizeWithLlm(rawText: string, aptName: string) {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system:
      "한국 아파트 분양공고 PDF 텍스트를 받아 핵심 정보 JSON으로만 응답합니다.",
    messages: [
      {
        role: "user",
        content: `다음은 "${aptName}" 분양공고 PDF에서 추출한 텍스트입니다.\n\n` +
          `핵심 정보를 JSON으로만 추출하세요 (다른 텍스트 금지).\n` +
          `필드: {\n` +
          `  "summary": "2~3문장 요약",\n` +
          `  "price_per_pyeong": 숫자(만원, 평당가, 모르면 null),\n` +
          `  "balcony_price": 숫자(만원, 발코니확장비, 모르면 null),\n` +
          `  "supply_price_info": {"min": 숫자|null, "max": 숫자|null, "unit": "만원"},\n` +
          `  "is_price_limit": true|false (분양가상한제 여부)\n` +
          `}\n\n--- 본문 ---\n${rawText.slice(0, 12000)}`,
      },
    ],
  });
  const text =
    msg.content
      .filter((b) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n") || "{}";
  // JSON 추출 (코드펜스 제거)
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const cronId = await logCronStart(supabase, "apt-summary-gen");

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const errors: { id: any; msg: string }[] = [];

  try {
    // 큐: raw_text 충분 + summary 비어있음
    const { data: rows, error: qErr } = await supabase
      .from("apt_subscriptions")
      .select(
        "id, house_nm, announcement_raw_text, price_per_pyeong, announcement_summary",
      )
      .gte("pdf_parse_version", 1)
      .not("announcement_raw_text", "is", null)
      .is("announcement_summary", null)
      .limit(BATCH_SIZE);
    if (qErr) throw new Error(`query_failed: ${qErr.message}`);
    if (!rows || rows.length === 0) {
      await logCronEnd(supabase, cronId, {
        status: "success",
        records_processed: 0,
        metadata: { queue_empty: true },
      });
      return NextResponse.json({ ok: true, queue_empty: true });
    }

    for (const row of rows) {
      processed++;
      const raw: string = row.announcement_raw_text || "";
      if (raw.length < MIN_RAW_LEN) {
        failed++;
        errors.push({ id: row.id, msg: `raw_too_short:${raw.length}` });
        continue;
      }

      // 1단계: 정규식 휴리스틱
      const heur = extractPriceHeuristic(raw);

      // 2단계: LLM 호출 (휴리스틱 실패 또는 summary 필요)
      let summary: string | null = null;
      let priceHeur = heur.price_per_pyeong;
      let balcony: number | null = null;
      let supplyInfo: any = null;
      let isPriceLimit: boolean | null = null;

      try {
        const llm = await summarizeWithLlm(raw, row.house_nm || "분양 단지");
        if (llm) {
          summary = llm.summary || null;
          if (!priceHeur && Number.isFinite(llm.price_per_pyeong)) {
            priceHeur = Number(llm.price_per_pyeong);
          }
          balcony = Number.isFinite(llm.balcony_price)
            ? Number(llm.balcony_price)
            : null;
          supplyInfo = llm.supply_price_info ?? null;
          isPriceLimit =
            typeof llm.is_price_limit === "boolean" ? llm.is_price_limit : null;
        }
      } catch (e: any) {
        // LLM 실패해도 휴리스틱 결과는 저장 시도
        errors.push({ id: row.id, msg: `llm_failed:${e?.message?.slice(0, 100)}` });
      }

      const update: Record<string, any> = {};
      if (summary) {
        update.ai_summary = summary; // text 컬럼
        update.announcement_summary = { summary, generated_at: new Date().toISOString() }; // jsonb 컬럼
      }
      if (priceHeur && priceHeur > 0) {
        update.price_per_pyeong = priceHeur;
        update.price_parsed_at = new Date().toISOString();
        update.price_source = heur.price_per_pyeong ? "heuristic" : "llm";
      }
      if (balcony !== null) update.balcony_price = balcony;
      if (supplyInfo) update.supply_price_info = supplyInfo;
      if (isPriceLimit !== null) update.is_price_limit = isPriceLimit;

      if (Object.keys(update).length === 0) {
        failed++;
        errors.push({ id: row.id, msg: "no_fields_extracted" });
        continue;
      }

      const { error: uErr } = await supabase
        .from("apt_subscriptions")
        .update(update)
        .eq("id", row.id);
      if (uErr) {
        failed++;
        errors.push({ id: row.id, msg: `update_failed:${uErr.message}` });
      } else {
        updated++;
      }
    }

    await logCronEnd(supabase, cronId, {
      status: "success",
      records_processed: processed,
      records_updated: updated,
      records_failed: failed,
      metadata: { errors: errors.slice(0, 10) },
    });
    return NextResponse.json({ ok: true, processed, updated, failed });
  } catch (e: any) {
    await logCronEnd(supabase, cronId, {
      status: "error",
      records_processed: processed,
      records_updated: updated,
      records_failed: failed,
      error_message: e?.message?.slice(0, 500) ?? "unknown",
      metadata: { errors: errors.slice(0, 10) },
    });
    return NextResponse.json(
      { ok: false, error: e?.message },
      { status: 500 },
    );
  }
}
