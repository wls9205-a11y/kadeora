export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { withCronAuthFlex } from '@/lib/cron-auth';
// V16 E-1: 정비사업 공급계약 공시 → 시공사 선정 자동 반영.
import { isConstructionCorp, isSupplyContract } from '@/lib/dart/redev-match';
import { processRedevFiling, REVIEW_TABLE, type RedevFiling } from '@/lib/dart/redev-pipeline';

/**
 * DART (전자공시시스템) 신규 공시 수집 크론
 * 
 * - DART Open API로 최근 공시 목록 조회
 * - dart_filings 테이블에 신규 공시 저장
 * - 15분 간격 실행 권장
 * - 분류·요약은 dart-classify / dart-summarize 크론에서 처리
 * 
 * 필요 환경변수: DART_API_KEY (DART Open API 인증키)
 */

const DART_API_BASE = 'https://opendart.fss.or.kr/api';

// DART 보고서 유형 → 카테고리 매핑
const REPORT_CATEGORY: Record<string, string> = {
  '주요사항보고서': '주요사항',
  '사업보고서': '사업보고서',
  '반기보고서': '반기보고서',
  '분기보고서': '분기보고서',
  '증권신고서': '증권신고',
  '매출액또는손익구조': '실적공시',
  '자기주식취득': '자사주',
  '자기주식처분': '자사주',
  '주요주주등': '주요주주변경',
  '임원ㆍ주요주주특정증권등': '임원매매',
  '합병등': '합병',
  '분할등': '분할',
  '유상증자': '유상증자',
  '무상증자': '무상증자',
};

function classifyReport(reportName: string): string {
  for (const [keyword, category] of Object.entries(REPORT_CATEGORY)) {
    if (reportName.includes(keyword)) return category;
  }
  return '기타';
}

// 중요도 점수 산정
function calcImportance(reportName: string, category: string): number {
  if (category === '실적공시') return 9;
  if (category === '주요주주변경') return 8;
  if (category === '합병' || category === '분할') return 9;
  if (category === '유상증자' || category === '무상증자') return 8;
  if (category === '자사주') return 7;
  if (category === '임원매매') return 6;
  if (reportName.includes('정정')) return 5;
  if (category === '사업보고서' || category === '분기보고서') return 6;
  return 4;
}

async function handler(_req: NextRequest) {
  const result = await withCronLogging('dart-ingest', async () => {
    const apiKey = process.env.DART_API_KEY;
    if (!apiKey) {
      return { processed: 0, created: 0, failed: 0, metadata: { error: 'DART_API_KEY not set' } };
    }

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // DART 최근 공시 목록 조회
    const url = `${DART_API_BASE}/list.json?crtfc_key=${apiKey}&bgn_de=${today}&page_count=100&sort=date&sort_mth=desc`;
    
    let items: any[] = [];
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.status !== '000') {
        return { processed: 0, created: 0, failed: 0, metadata: { dart_status: data.status, message: data.message } };
      }
      items = data.list || [];
    } catch (e: any) {
      return { processed: 0, created: 0, failed: 1, metadata: { error: e.message } };
    }

    if (!items.length) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_filings_today' } };
    }

    // 기존 rcept_no 확인 (중복 방지)
    const rceptNos = items.map((i: any) => i.rcept_no);
    const { data: existing } = await (supabase as any).from('dart_filings')
      .select('rcept_no')
      .in('rcept_no', rceptNos);
    const existingSet = new Set((existing || []).map((e: any) => e.rcept_no));

    let created = 0;
    let failed = 0;
    // V16 E-1: 정비사업 후보. 본문 수신이 붙으므로 메인 루프 밖에서 따로 처리한다 —
    //   여기서 왕복을 섞으면 공시 100건 루프가 그 지연을 다 뒤집어쓴다.
    const redevCandidates: RedevFiling[] = [];
    // s239 Phase 2.1: importance>=7 인 신규 dart_filing 을 issue_alerts 로도 자동 연결.
    // issue-preempt 의 apt_sites_gap INSERT 패턴 차용 (base_score / multiplier / score_breakdown).
    let issuesCreated = 0;
    let issuesSkipped = 0;

    for (const item of items) {
      if (existingSet.has(item.rcept_no)) continue;

      const category = classifyReport(item.report_nm || '');
      const importance = calcImportance(item.report_nm || '', category);

      // corp_code → symbol 매핑은 stock_quotes에서 조회
      let symbol: string | null = null;
      if (item.stock_code) {
        symbol = item.stock_code;
      }

      const filedAtIso = item.rcept_dt
        ? `${item.rcept_dt.slice(0, 4)}-${item.rcept_dt.slice(4, 6)}-${item.rcept_dt.slice(6, 8)}`
        : null;

      const { error } = await (supabase as any).from('dart_filings').insert({
        rcept_no: item.rcept_no,
        corp_code: item.corp_code,
        corp_name: item.corp_name,
        symbol,
        report_nm: item.report_nm,
        category,
        importance_score: importance,
        original_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
        filed_at: filedAtIso,
      });

      if (error) {
        console.error(`[dart-ingest] insert error for ${item.rcept_no}:`, error.message);
        failed++;
        continue;
      }
      created++;

      // V16 E-1 · 1차 필터의 절반 — 건설사 + 공급계약 체결.
      //   나머지 절반(본문에 구역/정비사업)은 본문을 받아야 볼 수 있어 아래에서 판정한다.
      //   ⚠️ 이름만으로는 조선·전자가 섞인다(HJ중공업·삼성중공업·한화오션·현대오토에버).
      //      본문 조건에서 떨어진 건 큐에도 넣지 않고 버린다.
      if (isConstructionCorp(item.corp_name) && isSupplyContract(item.report_nm)) {
        redevCandidates.push({
          rcept_no: item.rcept_no,
          corp_name: item.corp_name ?? '',
          report_nm: item.report_nm ?? '',
          filed_at: filedAtIso,
        });
      }

      // s239 Phase 2.1: 큰 이벤트 (importance>=7) 만 issue_alerts INSERT.
      // 임원매매(6) / 일반 보고서(4-5) 는 noise — skip.
      if (importance < 7) continue;

      // 멱등성: 동일 rcept_no 의 issue 가 이미 있으면 skip (cron 재실행 / partial failure 방어).
      const { data: existingIssue } = await (supabase as any).from('issue_alerts')
        .select('id')
        .eq('source_type', 'dart_filing')
        .filter('raw_data->>rcept_no', 'eq', item.rcept_no)
        .limit(1);
      if (existingIssue && existingIssue.length > 0) {
        issuesSkipped++;
        continue;
      }

      // base_score: importance * 5 (35/40/45). multiplier 1.25 (issue-preempt 차용).
      // → final 7=44, 8=50, 9=56. auto_publish_min_score=40 → 8/9 auto, 7 draft.
      const base = importance * 5;
      const mult = 1.25;
      const final = Math.round(base * mult);

      const corpName = item.corp_name || 'Unknown';
      const reportName = item.report_nm || category;
      const entities: string[] = [corpName];
      if (symbol) entities.push(symbol);

      const { error: issueErr } = await (supabase as any).from('issue_alerts').insert({
        title: `[DART] ${corpName} — ${reportName}`,
        summary: `${corpName}${symbol ? ` (${symbol})` : ''} ${reportName} 공시. DART 중요도 ${importance}/9 (${category}).`,
        category: 'stock',
        sub_category: category,
        issue_type: category,
        source_type: 'dart_filing',
        source_urls: [`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`],
        detected_keywords: [category, 'DART', '공시'].filter(Boolean),
        related_entities: entities,
        raw_data: {
          rcept_no: item.rcept_no,
          corp_code: item.corp_code,
          symbol,
          dart_category: category,
          report_nm: reportName,
          importance_score: importance,
          source_type: 'dart_filing',
          is_breaking: importance >= 8,
          has_news: true,
        },
        base_score: base,
        multiplier: mult,
        penalty_rate: 0,
        final_score: final,
        score_breakdown: { dart_importance: base, dart_multiplier: mult },
        is_auto_publish: final >= 40,
        detected_at: filedAtIso ? new Date(filedAtIso).toISOString() : new Date().toISOString(),
      });
      if (issueErr) {
        console.error(`[dart-ingest] issue_alerts insert error ${item.rcept_no}:`, issueErr.message);
      } else {
        issuesCreated++;
      }
    }

    // ── V16 E-1 · 정비사업 반영 ──
    //   실측 빈도는 하루 1~2건이다 (건설사 공급계약 90일 100건). 그래도 상한을 둔다 —
    //   정정 공시가 몰린 날 본문 왕복이 크론 maxDuration 을 잡아먹으면 수집 자체가 끊긴다.
    const REDEV_CAP = 8;
    let redevAuto = 0, redevQueued = 0, redevDiscarded = 0;
    if (redevCandidates.length > 0 && apiKey) {
      for (const f of redevCandidates.slice(0, REDEV_CAP)) {
        try {
          const r = await processRedevFiling(f, apiKey);
          if (r.kind === 'auto') redevAuto++;
          else if (r.kind === 'queue') redevQueued++;
          else redevDiscarded++;
        } catch (e: any) {
          // 한 건이 실패해도 수집 결과를 되돌리지 않는다.
          console.error('[dart-ingest] redev 처리 실패', f.rcept_no, e?.message ?? String(e));
          redevQueued++;
        }
      }
    }

    // ── 본문 수신 실패로 큐에 갇힌 건 재시도 ──
    //
    // 이전에는 본문을 못 받으면 그 행이 pending 으로 **영원히** 남았다. 재시도 경로가 없어
    // 실측 3건(DL이앤씨·동부건설)이 zone_candidates=[] 인 채 멈춰 있었고,
    // 구역명 후보가 비어 있으니 사람이 맞음/틀림을 누를 재료도 없었다.
    //
    // 일시적 실패(타임아웃·5xx)면 다음 실행에서 열리고, 애초에 정비사업이 아니면
    // bodyMentionsRedev 가 걸러 discarded 로 닫힌다 — 어느 쪽이든 큐가 정리된다.
    // ⚠️ 상한을 둔다. 영구 실패건이 쌓이면 매 실행 본문 왕복이 크론을 잡아먹는다.
    const RETRY_CAP = 5;
    let redevRetried = 0, redevRetryResolved = 0;
    let redevRetryHalted: string | null = null;
    if (apiKey) {
      // database.ts 가 apt_stage_review_queue 를 아직 모른다 (저장소 as any 관례).
      const { data: stuck } = await (supabase as any)
        .from(REVIEW_TABLE)
        .select('rcept_no, corp_name, report_nm, filed_at')
        .eq('status', 'pending')
        .like('reason', 'body_fetch_failed%')
        .order('created_at', { ascending: true })
        .limit(RETRY_CAP);

      for (const q of (stuck ?? []) as any[]) {
        // 방금 위 루프에서 처리한 건은 건너뛴다 — 같은 실행에서 두 번 왕복하지 않는다.
        if (redevCandidates.some((c: any) => c.rcept_no === q.rcept_no)) continue;
        redevRetried++;
        try {
          const r = await processRedevFiling(
            { rcept_no: q.rcept_no, corp_name: q.corp_name, report_nm: q.report_nm, filed_at: q.filed_at },
            apiKey,
          );
          if (r.kind !== 'queue') redevRetryResolved++;
          else if (!r.reason.startsWith('body_fetch_failed')) redevRetryResolved++;

          // ⚠️ 일 20,000건 한도를 넘긴 상태다. 더 두드리면 한도만 태우고 결과는 같다.
          //    이번 회차는 여기서 멈춘다 — 다음 실행(15분 뒤)에 이어서 한다.
          if (r.kind === 'queue' && r.reason.includes('opendart_020')) {
            redevRetryHalted = 'rate_limited';
            break;
          }
        } catch (e: any) {
          console.error('[dart-ingest] redev 재시도 실패', q.rcept_no, e?.message ?? String(e));
        }
      }
    }

    return {
      processed: items.length,
      created,
      failed,
      metadata: {
        api_name: 'dart', api_calls: 1,
        issues_created: issuesCreated, issues_skipped_dup: issuesSkipped,
        redev_candidates: redevCandidates.length,
        redev_auto: redevAuto, redev_queued: redevQueued, redev_discarded: redevDiscarded,
        redev_retried: redevRetried, redev_retry_resolved: redevRetryResolved,
        redev_retry_halted: redevRetryHalted,
      },
    };
  });

  return NextResponse.json(result);
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
