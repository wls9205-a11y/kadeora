/**
 * [SUBSCRIPTION-PRE-BLOG] 청약 D-30/D-7/D-1 자동 draft 생성 + Node 알림톡
 *
 * 동작:
 *  - apt_subscriptions rcept_bgnde가 오늘 기준 -30/-7/-1 일인 단지 탐색
 *  - 각 단지에 대해:
 *     1) big_event_registry priority_score +10 bump
 *     2) draft 생성: blog_posts is_published=false 로 safeBlogInsert
 *     3) [절대 팩트 고정] 블록 포함 (big_event 연결되면 registry 조회 참조)
 *     4) Node 알림톡: "draft 대기 — 검수 필요" (Solapi)
 *  - 일 1회 pg_cron 실행 (Vercel 100 cron 한도 외부)
 *
 * 생성 draft는 관리자가 검수 후 수동 publish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { sendKakaoAlimtalk } from '@/lib/kakao-alimtalk';
import { NotificationBellService } from '@/lib/notification-bell';

export const maxDuration = 240;
export const runtime = 'nodejs';

const NOTIFY_TEMPLATE_ID = process.env.SOLAPI_TEMPLATE_DRAFT_READY || '';
const NOTIFY_PHONE = process.env.NODE_NOTIFY_PHONE || '';

type Phase = 'D-30' | 'D-7' | 'D-1';

function addDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function phaseTitle(name: string, phase: Phase, region: string): string {
  const ko = phase === 'D-30' ? '예정 — 30일 남았다'
           : phase === 'D-7'  ? '가점 커트라인 예상'
           : '최종 체크리스트';
  return `${name} 청약 ${phase} ${ko} (${region} 2026)`;
}

function buildBody(opts: {
  phase: Phase;
  name: string;
  region: string;
  receipt: string;
  scale: number | null;
  constructor: string | null;
  factBlock: string;
}): string {
  const { phase, name, region, receipt, scale, constructor, factBlock } = opts;
  const scaleLine = scale ? `${scale.toLocaleString()}세대` : '세대수 미확정';
  const ctorLine = constructor || '시공사 미확정';

  if (phase === 'D-30') {
    return `# ${name} 청약 D-30 — 30일 남았다 (${region})

${factBlock ? `> ${factBlock.replace(/\n/g, ' ')}\n\n` : ''}
${name} (${region}) 청약이 **약 30일** 남았습니다. 접수 시작 ${receipt || '미정'}. 지금부터 준비해야 할 5가지를 정리합니다.

## 핵심 정보

| 항목 | 내용 |
|---|---|
| 단지 | ${name} |
| 지역 | ${region} |
| 공급규모 | ${scaleLine} |
| 시공 | ${ctorLine} |
| 접수 | ${receipt || '미정'} |

## D-30 체크리스트
- 청약통장 1순위 자격 유지 확인
- 무주택 세대주 상태 재확인
- 해당 지역 거주 요건 점검 ([청약 가점 계산](/apt/diagnose))
- 예상 분양가 추정 + 자금 계획 초안
- 조정대상지역·규제 여부 확인

## 자주 묻는 질문
### Q1. 접수일까지 준비가 늦을까요?
지금부터도 충분합니다. 청약통장 가점·자격 확인은 2주면 완료.

### Q2. 가점 커트라인은?
인접 단지 최근 청약 커트라인을 기준으로 추정합니다. D-7 글에서 업데이트 예정.

### Q3. 시공사 확정되지 않았는데 매수해도 되나요?
분양 공고 시점에 시공사는 확정됩니다. 공고문 필수 확인.

## 관련 링크
- [전국 청약 일정](/apt)
- [청약 가점 계산기](/apt/diagnose)
- [전국 재건축·재개발 모음](/apt/big-events)

---
*카더라 자동 생성 draft — Node 검수 후 공개. 팩트는 공식 공고문 확정 후 업데이트됩니다.*`;
  }
  if (phase === 'D-7') {
    return `# ${name} 청약 D-7 — 가점 커트라인 예상 (${region})

${factBlock ? `> ${factBlock.replace(/\n/g, ' ')}\n\n` : ''}
${name} 청약 접수일이 **일주일** 남았습니다. 지난 7일 사이 공개된 분양 조건과 비교 단지 커트라인으로 가점 커트라인을 추정합니다.

## 예상 가점 커트라인

| 평형 | 가점 추정 |
|---|---|
| 59㎡ (소형) | 50~60점 |
| 84㎡ (중형) | 60~70점 |
| 전용 100㎡+ | 65~75점 |

## 체크 포인트
- 해당 지역 1순위 거주자 우선 배정 물량 확인
- 특별공급 신청 여부 최종 결정
- 예상 분양가 × 10% 계약금 자금 준비

## 자주 묻는 질문
### Q1. 70점이면 당첨 가능?
인기 세대는 70점+가 커트라인. 중간·비선호 세대는 60점대로도 가능.

### Q2. 특별공급이 유리한가?
다자녀·신혼·생애최초는 특공 우선. 경쟁률이 일반공급보다 낮은 경우 많음.

### Q3. 자금 계획은 얼마?
계약금 10% + 중도금 60% (대출) + 잔금 30%.

## 관련 링크
- [청약 가점 계산기](/apt/diagnose)
- [전국 청약 일정](/apt)
- [전국 재건축·재개발](/apt/big-events)

---
*카더라 자동 생성 draft — Node 검수 후 공개. 가점 커트라인은 추정치입니다.*`;
  }
  // D-1
  return `# ${name} 청약 D-1 — 최종 체크리스트 (${region})

${factBlock ? `> ${factBlock.replace(/\n/g, ' ')}\n\n` : ''}
${name} 청약 접수 **하루 전**. 실수 없이 신청하기 위한 최종 점검 체크리스트입니다.

## D-1 최종 체크

| 항목 | 확인 |
|---|---|
| 청약통장 납입 24회+ | ☐ |
| 무주택 세대주 유지 | ☐ |
| 해당 지역 거주 요건 | ☐ |
| 신청할 평형·타입 결정 | ☐ |
| 계약금 자금 준비 | ☐ |
| 공인인증서·모바일 공고 확인 | ☐ |

## 신청 당일 팁
- 접수 시작 시간 직후보다 **오후가 안정적** (서버 부하 회피)
- 특별공급은 일반공급과 **별도 신청**
- 접수증 캡처 필수

## 자주 묻는 질문
### Q1. 접수 시간이 겹치면?
공식 시스템 기준시간을 따릅니다. 신청 완료 화면 캡처 보관.

### Q2. 접수 후 수정 가능?
한 번 접수하면 수정 불가. 신중히 선택.

### Q3. 당첨 확인 언도?
통상 접수 후 2주 내 발표.

## 관련 링크
- [전국 청약 일정](/apt)
- [청약 가점 계산기](/apt/diagnose)
- [전국 재건축·재개발 모음](/apt/big-events)

---
*카더라 자동 생성 draft — Node 검수 후 공개.*`;
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('subscription-prebrief-generator', async () => {
      const sb = getSupabaseAdmin();
      const now = new Date();

      // D-30, D-7, D-1 접수 시작일 도래 단지 모음
      const targets: { phase: Phase; date: string }[] = [
        { phase: 'D-30', date: addDays(now, 30) },
        { phase: 'D-7', date: addDays(now, 7) },
        { phase: 'D-1', date: addDays(now, 1) },
      ];

      let created = 0;
      let failed = 0;
      const skipped: string[] = [];

      for (const t of targets) {
        const { data: subs } = await (sb as any)
          .from('apt_subscriptions')
          .select('id, house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, constructor_nm, pblanc_url')
          .eq('rcept_bgnde', t.date)
          .not('house_nm', 'is', null)
          .limit(50);

        if (!subs || subs.length === 0) continue;

        for (const sub of subs as any[]) {
          const region = (sub.region_nm || '').trim();

          // big_event 연결 조회 + priority +10 (조건: 이미 등록된 경우만)
          let factBlock = '';
          const { data: ev } = await (sb as any)
            .from('big_event_registry')
            .select('id, name, region_sido, region_sigungu, event_type, stage, scale_before, scale_after, key_constructors, new_brand_name, constructor_status, notes, priority_score')
            .or(`name.eq.${sub.house_nm},slug.ilike.%${(sub.house_nm || '').slice(0, 10)}%`)
            .limit(1)
            .maybeSingle();
          if (ev) {
            await (sb as any)
              .from('big_event_registry')
              .update({ priority_score: Math.min(100, Number(ev.priority_score || 50) + 10), updated_at: new Date().toISOString() })
              .eq('id', ev.id);
            const constructors = Array.isArray(ev.key_constructors) ? ev.key_constructors.join(', ') : (ev.key_constructors || '');
            factBlock = `[절대 팩트 고정] ${ev.name} · ${ev.region_sido || ''} ${ev.region_sigungu || ''} · ${ev.event_type || ''} Stage ${ev.stage} · ${ev.scale_before ?? '?'}→${ev.scale_after ?? '?'}세대 · 시공 ${constructors || '미정'}${ev.new_brand_name ? ` · 브랜드 ${ev.new_brand_name} (${ev.constructor_status || 'unconfirmed'})` : ''}`;
          }

          const slug = `${sub.house_nm}-chungyak-${t.phase.toLowerCase()}`
            .replace(/\s+/g, '-')
            .replace(/[()]/g, '')
            .slice(0, 80);

          const title = phaseTitle(sub.house_nm, t.phase, region);
          const content = buildBody({
            phase: t.phase,
            name: sub.house_nm,
            region,
            receipt: sub.rcept_bgnde || '',
            scale: Number(sub.tot_supply_hshld_co || 0) || null,
            constructor: sub.constructor_nm || null,
            factBlock,
          });

          const result = await safeBlogInsert(sb as any, {
            slug,
            title,
            content,
            category: 'apt',
            sub_category: '청약',
            tags: [sub.house_nm, region, '청약', t.phase, ...(sub.constructor_nm ? [sub.constructor_nm] : [])],
            source_type: 'auto_subscription_prebrief',
            cron_type: 'subscription-prebrief-generator',
            source_ref: sub.pblanc_url || '',
            meta_description: `${sub.house_nm} 청약 ${t.phase} 선제 브리핑 — ${region} 신축분양 체크리스트와 가점 전망`,
            meta_keywords: [sub.house_nm, '청약', t.phase, '가점', region].join(','),
            cover_image: null,
            image_alt: `${sub.house_nm} 청약 ${t.phase}`,
            is_published: false,
          } as any);

          if (result.success) {
            created++;
            // [NOTIFY-BELL] 앱 내 벨 우선
            try {
              await NotificationBellService.pushDraftReady({
                name: sub.house_nm,
                phase: t.phase,
                region,
                slug,
              });
            } catch { /* ignore */ }
            if (NOTIFY_TEMPLATE_ID && NOTIFY_PHONE) {
              try {
                await sendKakaoAlimtalk({
                  phone: NOTIFY_PHONE.replace(/[^0-9]/g, ''),
                  templateId: NOTIFY_TEMPLATE_ID,
                  variables: {
                    '#{name}': sub.house_nm,
                    '#{phase}': t.phase,
                    '#{region}': region,
                    '#{slug}': slug,
                  },
                });
              } catch { /* notify 실패해도 draft는 유지 */ }
            }
          } else if (result.reason === 'duplicate_slug') {
            skipped.push(`${slug}:duplicate_slug`);
          } else {
            failed++;
            skipped.push(`${slug}:${result.reason || 'unknown'}`);
          }
        }
      }

      return {
        processed: created + failed,
        created,
        failed,
        metadata: { sample_skipped: skipped.slice(0, 10) },
      };
    }, { redisLockTtlSec: 300 }),
  );
}

export const GET = withCronAuth(handler);
