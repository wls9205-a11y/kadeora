import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 부동산 현장 AI 한줄 분석 자동 생성
 * 규칙 기반으로 현장 데이터를 분석하여 투자 포인트 요약
 * 매일 05시 실행
 */

function generateSubSummary(apt: any): string {
  const parts: string[] = [];
  const supply = apt.tot_supply_hshld_co || 0;
  const rate = apt.competition_rate_1st ? Number(apt.competition_rate_1st) : 0;
  const isPriceLimit = apt.is_price_limit;
  const mvn = apt.mvn_prearnge_ym || '';
  const region = apt.region_nm || '';

  // 규모
  if (supply >= 3000) parts.push('초대형 단지');
  else if (supply >= 1000) parts.push('대단지');
  else if (supply <= 100) parts.push('소규모 단지');

  // 경쟁률
  if (rate >= 50) parts.push(`🔥 경쟁률 ${rate.toFixed(0)}:1 초고경쟁`);
  else if (rate >= 10) parts.push(`경쟁률 ${rate.toFixed(1)}:1 높은 관심`);
  else if (rate > 0 && rate < 1) parts.push('미달, 추가 기회 있음');

  // 분양가상한제
  if (isPriceLimit) parts.push('분양가상한제 적용 (시세 대비 저렴)');

  // 지역 특성
  if (['서울', '강남', '서초', '송파'].some(k => region.includes(k))) parts.push('서울 핵심 입지');
  else if (region === '경기') parts.push('수도권');

  // 입주시기
  if (mvn) {
    const mvnYear = parseInt(mvn.slice(0, 4));
    const diff = mvnYear - new Date().getFullYear();
    if (diff <= 1) parts.push('단기 입주 가능');
    else if (diff >= 4) parts.push(`입주까지 ${diff}년 소요`);
  }

  if (apt.constructor_nm) parts.push(`${apt.constructor_nm} 시공`);

  return parts.length > 0 ? parts.join(' · ') : `${region} ${supply > 0 ? supply.toLocaleString() + '세대' : ''} 분양`;
}

function generateUnsoldSummary(u: any): string {
  const parts: string[] = [];
  const unsold = u.tot_unsold_hshld_co || 0;
  const total = u.tot_supply_hshld_co || 0;
  const rate = total > 0 ? Math.round((unsold / total) * 100) : 0;

  if (rate >= 80) parts.push('⚠️ 심각한 미분양');
  else if (rate >= 50) parts.push('미분양률 높음, 할인 가능성');
  else if (rate >= 20) parts.push('일부 미분양');
  else parts.push('소량 미분양');

  if (unsold >= 500) parts.push(`${unsold.toLocaleString()}호 대량 미분양`);

  if (u.discount_info) parts.push(`할인: ${u.discount_info}`);

  return parts.join(' · ') || `미분양 ${unsold}호`;
}

function generateRedevSummary(r: any): string {
  const parts: string[] = [];
  const stage = r.stage || '';

  const stageDesc: Record<string, string> = {
    '정비구역지정': '초기 단계, 장기 투자 관점',
    '조합설립': '조합 설립 완료, 사업 추진 본격화',
    '사업시행인가': '사업 인가 완료, 시공사 선정 전후',
    '관리처분': '관리처분 단계, 분양 임박',
    '착공': '공사 진행 중, 입주 가시권',
  };

  if (stageDesc[stage]) parts.push(stageDesc[stage]);
  if (r.constructor) parts.push(`${r.constructor} 시공`);
  if (r.total_households) parts.push(`${r.total_households.toLocaleString()}세대 규모`);

  return parts.join(' · ') || `${r.project_type || '재개발'} ${stage}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('apt-ai-summary', async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let updated = 0;

    // 1. 청약 — ai_summary 없는 것들만
    const { data: subs } = await supabase.from('apt_subscriptions')
      .select('id, house_nm, region_nm, tot_supply_hshld_co, competition_rate_1st, is_price_limit, mvn_prearnge_ym, constructor_nm')
      .is('ai_summary', null)
      .limit(100);

    for (const apt of (subs || [])) {
      const summary = generateSubSummary(apt);
      await supabase.from('apt_subscriptions').update({ ai_summary: summary }).eq('id', apt.id);
      updated++;
    }

    // 2. 미분양
    const { data: unsolds } = await supabase.from('unsold_apts')
      .select('id, house_nm, tot_unsold_hshld_co, tot_supply_hshld_co, discount_info')
      .eq('is_active', true).is('ai_summary', null)
      .limit(50);

    for (const u of (unsolds || [])) {
      const summary = generateUnsoldSummary(u);
      await supabase.from('unsold_apts').update({ ai_summary: summary }).eq('id', u.id);
      updated++;
    }

    // 3. 재개발
    const { data: redevs } = await supabase.from('redevelopment_projects')
      .select('id, district_name, stage, project_type, constructor, total_households')
      .eq('is_active', true).is('ai_summary', null)
      .limit(100);

    for (const r of (redevs || [])) {
      const summary = generateRedevSummary(r);
      await supabase.from('redevelopment_projects').update({ ai_summary: summary }).eq('id', r.id);
      updated++;
    }

    return { processed: updated, created: updated, failed: 0, metadata: { subs: (subs || []).length, unsolds: (unsolds || []).length, redevs: (redevs || []).length } };
  });

  return NextResponse.json({ ok: true, ...result });
}
