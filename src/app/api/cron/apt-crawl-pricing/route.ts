import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;

/**
 * 분양가 상세 자동 수집 크론
 * 
 * 소스: 공공데이터포털 청약홈 APT 분양정보 모델 API
 *   → getAPTLttotPblancMdl (평형별 분양가 + 공급세대 + 특별공급 + 신청자수)
 * 
 * 수집 대상:
 *   - house_type_info가 NULL 또는 빈 배열인 apt_subscriptions
 *   - house_manage_no가 있는 레코드만
 * 
 * 수집 데이터:
 *   - house_type_info: [{type, area, supply, spsply_hshldco, lttot_top_amount, apply, rate}]
 *   - price_per_pyeong_avg: 평균 평당가 자동 계산
 * 
 * 스케줄: 매 6시간
 * 배치: 50건/실행, 하루 200건, 약 14일에 전체 완료
 */

export const GET = withCronAuth(async (_req: NextRequest) => {
  const APT_API_KEY = process.env.APT_DATA_API_KEY;
  if (!APT_API_KEY) {
    return NextResponse.json({ ok: true, error: 'APT_DATA_API_KEY not set', updated: 0 });
  }

  const result = await withCronLogging('apt-crawl-pricing', async () => {
    const sb = getSupabaseAdmin();
    const BATCH_SIZE = 250;

    // 1. house_type_info가 비어있는 청약 레코드 조회
    const { data: targets } = await sb.from('apt_subscriptions')
      .select('id, house_manage_no, house_nm')
      .not('house_manage_no', 'is', null)
      .or('house_type_info.is.null,house_type_info.eq.[]')
      .order('rcept_bgnde', { ascending: false })
      .limit(BATCH_SIZE);

    if (!targets?.length) {
      return { processed: 0, created: 0, updated: 0, failed: 0, metadata: { message: '백필 대상 없음 — 전체 분양가 수집 완료' } };
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const apt of targets) {
      try {
        // 2. 청약홈 모델(평형) 상세 API 호출
        const url = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl?serviceKey=${encodeURIComponent(APT_API_KEY)}&cond[HOUSE_MANAGE_NO::EQ]=${apt.house_manage_no}&perPage=50`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        
        if (!res.ok) {
          // API 에러 시 빈 배열로 마킹 (재시도 방지)
          if (res.status === 401 || res.status === 403) {
            errors.push(`API 인증 오류 ${res.status}`);
            break; // 키 문제면 전체 중단
          }
          failed++;
          continue;
        }

        const resText = await res.text();
        let json;
        try { json = JSON.parse(resText); } catch { failed++; continue; }
        const items = json?.data || [];

        if (!Array.isArray(items) || items.length === 0) {
          // 데이터 없음 → 빈 배열로 마킹 (반복 조회 방지)
          await sb.from('apt_subscriptions').update({
            house_type_info: [],
          }).eq('id', apt.id);
          continue;
        }

        // 3. 평형별 분양가 파싱
        const typeInfo = items.map((item: any) => ({
          type: item.HOUSE_TY || item.houseTy || '',
          area: item.SUPLY_AR || item.suplyAr || '',
          supply: parseInt(item.SUPLY_HSHLDCO || item.suplyHshldco || '0') || 0,
          spsply_hshldco: parseInt(item.SPSPLY_HSHLDCO || item.spsplyHshldco || '0') || 0,
          lttot_top_amount: parseInt(item.LTTOT_TOP_AMOUNT || item.lttotTopAmount || '0') || 0,
          apply: parseInt(item.RCEPT_CNT || item.rceptCnt || '0') || 0,
          rate: (() => {
            const s = parseInt(item.SUPLY_HSHLDCO || item.suplyHshldco || '0') || 0;
            const a = parseInt(item.RCEPT_CNT || item.rceptCnt || '0') || 0;
            return s > 0 ? Math.round((a / s) * 10) / 10 : 0;
          })(),
        }));

        // 4. 평당가 자동 계산
        const priceTypes = typeInfo.filter((t: any) => {
          const price = t.lttot_top_amount;
          const typeStr = t.type || '';
          const exclusiveArea = parseFloat(typeStr.replace(/[A-Za-z]/g, ''));
          return price > 0 && exclusiveArea > 10;
        });
        
        let pricePerPyeongAvg = null;
        if (priceTypes.length > 0) {
          const avgPyeong = priceTypes.reduce((sum: number, t: any) => {
            const exclusiveArea = parseFloat((t.type || '0').replace(/[A-Za-z]/g, ''));
            return sum + (t.lttot_top_amount / (exclusiveArea / 3.3058));
          }, 0) / priceTypes.length;
          pricePerPyeongAvg = Math.round(avgPyeong);
        }

        // 5. 경쟁률도 함께 계산 (있으면)
        const totalApply = typeInfo.reduce((s: number, t: any) => s + (t.apply || 0), 0);
        const totalSupply = typeInfo.reduce((s: number, t: any) => s + (t.supply || 0), 0);
        const competitionRate = totalSupply > 0 && totalApply > 0
          ? Math.round((totalApply / totalSupply) * 10) / 10
          : null;

        // 6. DB 업데이트
        const updateData: Record<string, any> = {
          house_type_info: typeInfo,
        };
        if (pricePerPyeongAvg) updateData.price_per_pyeong_avg = pricePerPyeongAvg;
        if (competitionRate && competitionRate > 0) {
          updateData.competition_rate_1st = competitionRate;
          updateData.total_apply_count = totalApply;
          updateData.supply_count = totalSupply;
        }

        await sb.from('apt_subscriptions').update(updateData).eq('id', apt.id);
        updated++;

        // 7. apt_sites에도 가격 자동 싱크 (이름 매칭)
        const prices = typeInfo.map((t: any) => t.lttot_top_amount).filter((p: number) => p > 0);
        if (prices.length > 0) {
          const siteMin = Math.min(...prices);
          const siteMax = Math.max(...prices);
          await sb.from('apt_sites').update({
            price_min: siteMin, price_max: siteMax, updated_at: new Date().toISOString(),
          }).eq('name', apt.house_nm).or('price_min.is.null,price_min.eq.0');
        }

        // API 부하 방지 (최소 딜레이)
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        failed++;
        errors.push(`${apt.house_nm}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return {
      processed: targets.length,
      created: updated,
      updated,
      failed,
      metadata: {
        remaining: targets.length === BATCH_SIZE ? '추가 실행 필요' : '이번 배치 완료',
        errors: errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
      },
    };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
