export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    for (const item of items) {
      if (existingSet.has(item.rcept_no)) continue;

      const category = classifyReport(item.report_nm || '');
      const importance = calcImportance(item.report_nm || '', category);

      // corp_code → symbol 매핑은 stock_quotes에서 조회
      let symbol: string | null = null;
      if (item.stock_code) {
        symbol = item.stock_code;
      }

      const { error } = await (supabase as any).from('dart_filings').insert({
        rcept_no: item.rcept_no,
        corp_code: item.corp_code,
        corp_name: item.corp_name,
        symbol,
        report_nm: item.report_nm,
        category,
        importance_score: importance,
        original_url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
        filed_at: item.rcept_dt
          ? `${item.rcept_dt.slice(0, 4)}-${item.rcept_dt.slice(4, 6)}-${item.rcept_dt.slice(6, 8)}`
          : null,
      });

      if (error) {
        console.error(`[dart-ingest] insert error for ${item.rcept_no}:`, error.message);
        failed++;
      } else {
        created++;
      }
    }

    return {
      processed: items.length,
      created,
      failed,
      metadata: { api_name: 'dart', api_calls: 1 },
    };
  });

  return NextResponse.json(result);
}
