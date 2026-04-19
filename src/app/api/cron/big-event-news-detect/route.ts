/**
 * [CRAWLER-NEWS] big_event_registry 기반 네이버 뉴스 RSS 감지
 *
 * - is_active=true 모든 big_event 대상
 * - 네이버 뉴스 검색 API로 "{name} {region_sigungu} {event_type}" 쿼리
 * - 새 기사 감지 (fact_sources에 없는 URL) → big_event_milestones(milestone_type='news_detected') INSERT
 * - 중요 기사 감지 (제목에 시공사/분양/이주/착공/인가/총회) → Solapi 알림톡 Node 발송
 * - Vercel 100 cron 한도 초과로 pg_cron으로 30분 주기 트리거 예정
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendKakaoAlimtalk } from '@/lib/kakao-alimtalk';
import { NotificationBellService } from '@/lib/notification-bell';

export const maxDuration = 180;
export const runtime = 'nodejs';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const NOTIFY_TEMPLATE_ID = process.env.SOLAPI_TEMPLATE_BIG_EVENT_NEWS || '';
const NOTIFY_PHONE = process.env.NODE_NOTIFY_PHONE || '';

const CRITICAL_KEYWORDS = ['시공사', '분양', '이주', '착공', '인가', '총회', '관리처분', '감정평가'];

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  originallink?: string;
}

async function fetchNaverNews(query: string, display = 10): Promise<NewsItem[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}

function isCritical(title: string): boolean {
  const t = stripHtml(title);
  return CRITICAL_KEYWORDS.some((k) => t.includes(k));
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('big-event-news-detect', async () => {
      const sb = getSupabaseAdmin();

      if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return { processed: 0, metadata: { error: 'NAVER keys missing' } };
      }

      const { data: events } = await (sb as any)
        .from('big_event_registry')
        .select('id, slug, name, region_sigungu, new_brand_name, event_type, fact_sources')
        .eq('is_active', true)
        .order('priority_score', { ascending: false })
        .limit(50);

      if (!events || events.length === 0) {
        return { processed: 0, metadata: { message: 'no active events' } };
      }

      let totalDetected = 0;
      let criticalNotified = 0;
      const failures: string[] = [];

      for (const ev of events as any[]) {
        try {
          const queries: string[] = [];
          if (ev.name && ev.region_sigungu) {
            queries.push(`${ev.name} ${ev.region_sigungu} ${ev.event_type || '재건축'}`);
          }
          if (ev.new_brand_name) queries.push(`${ev.new_brand_name} ${ev.name || ''}`.trim());

          const existingSources: Set<string> = new Set(
            Array.isArray(ev.fact_sources) ? ev.fact_sources : [],
          );

          // 기존 감지된 URL도 중복 방지
          const { data: existingMilestones } = await (sb as any)
            .from('big_event_milestones')
            .select('metadata')
            .eq('event_id', ev.id)
            .eq('milestone_type', 'news_detected')
            .order('created_at', { ascending: false })
            .limit(60);
          for (const m of (existingMilestones || []) as any[]) {
            const u = m?.metadata?.url;
            if (typeof u === 'string') existingSources.add(u);
          }

          const seenNow = new Set<string>();
          for (const q of queries) {
            const items = await fetchNaverNews(q, 10);
            for (const item of items) {
              const url = (item.link || item.originallink || '').trim();
              if (!url) continue;
              if (existingSources.has(url) || seenNow.has(url)) continue;
              seenNow.add(url);

              const title = stripHtml(item.title || '');
              const desc = stripHtml(item.description || '').slice(0, 300);
              const critical = isCritical(title);

              const { error } = await (sb as any).from('big_event_milestones').insert({
                event_id: ev.id,
                milestone_type: 'news_detected',
                scheduled_at: null,
                completed_at: new Date().toISOString(),
                metadata: {
                  url,
                  title,
                  description: desc,
                  pub_date: item.pubDate || null,
                  critical,
                  matched_query: q,
                },
              });
              if (error) {
                failures.push(`${ev.id}:${error.message}`);
                continue;
              }
              totalDetected++;

              if (critical) {
                // [NOTIFY-BELL] 앱 내 벨 우선 (무료·실시간) + Solapi 템플릿 있을 때만 보조
                try {
                  await NotificationBellService.pushBigEventNews({
                    eventName: ev.name || ev.slug || '',
                    title: title.slice(0, 200),
                    url: url.slice(0, 500),
                    critical: true,
                  });
                  criticalNotified++;
                } catch { /* bell 실패해도 흐름 유지 */ }

                if (NOTIFY_TEMPLATE_ID && NOTIFY_PHONE) {
                  try {
                    await sendKakaoAlimtalk({
                      phone: NOTIFY_PHONE.replace(/[^0-9]/g, ''),
                      templateId: NOTIFY_TEMPLATE_ID,
                      variables: {
                        '#{event_name}': ev.name || ev.slug || '',
                        '#{title}': title.slice(0, 80),
                        '#{url}': url.slice(0, 120),
                      },
                    });
                  } catch (err: any) {
                    failures.push(`notify-fail:${err?.message || 'unknown'}`);
                  }
                }
              }
            }
            await new Promise((r) => setTimeout(r, 200)); // rate limit cushion
          }
        } catch (err: any) {
          failures.push(`${ev.id}:${err?.message || 'unknown'}`);
        }
      }

      return {
        processed: events.length,
        created: totalDetected,
        failed: failures.length,
        metadata: {
          critical_notified: criticalNotified,
          sample_failures: failures.slice(0, 5),
        },
      };
    }, { redisLockTtlSec: 240 }),
  );
}

export const GET = withCronAuth(handler);
