'use client';
/**
 * H6-2 — /apt 2단 「최근 청약 공고」 캐러셀.
 *
 * ── 왜 캐러셀인가 ───────────────────────────────────────────────────────────
 * 이미지 카드 1장이 모바일 뷰포트의 «절반» 을 먹고 있었다(두산위브 대연). 그러면
 * 목록이 시작되기 전에 화면이 끝난다. 가로로 눕히면 같은 자리에 8장이 들어간다.
 *
 * ⚠️ 이미지가 «있을 때만» 이미지 카드다. 없으면 네이비 폴백 카드 —
 *    이니셜 블록이나 회색 자리를 만들지 않는다. 없는 것을 있는 척하지 않는다.
 * ⛔ 위성 이미지를 쓰지 않는다(2026-08-25 이미지 정책). 실사만.
 *
 * ⚠️ 네이비 폴백은 /apt 2단에서 «유일한 네이비» 다. 히어로가 없는 화면이라
 *    「네이비 덩어리 하나」 규칙에 어긋나지 않는다 — 선택된 타일·칩은 1단·칩 줄에 있고
 *    2단에서는 칩만 남는다.
 *
 * ⚠️ 가로 스크롤은 «스냅» 만 쓴다. 자동 재생 없음 — 읽는 중에 움직이는 것은 모션이 아니라 방해다.
 */

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import type { RegionBlockItem } from '@/lib/apt/region-blocks';
import SafeImg from '@/components/apt/SafeImg';

const STAGE_LABEL: Record<string, string> = {
  pre_announcement: '분양예정',
  model_house_open: '견본주택',
  special_supply: '특별공급',
  subscription_open: '접수중',
  award_pending: '발표 대기',
  award_announced: '당첨자 발표',
  contract_signing: '계약',
  construction: '공사중',
  move_in_ready: '입주 예정',
  move_in_started: '입주중',
  post_move_in: '입주 완료',
};

/** D-day 를 «아직 의미 있는» 단계에서만 낸다(H6-1 과 같은 기준). */
const DDAY_STAGES = new Set(['pre_announcement', 'subscription_open', 'award_pending']);

function ddayOf(it: RegionBlockItem): string | null {
  if (!it.lifecycle_stage || !DDAY_STAGES.has(it.lifecycle_stage)) return null;
  const target = it.lifecycle_stage === 'pre_announcement' ? it.rcept_bgnde : it.rcept_endde;
  if (!target) return null;
  const d = Math.ceil((new Date(target + 'T00:00:00+09:00').getTime() - Date.now()) / 86400000);
  if (d < 0) return null;                       // 지난 날짜는 내지 않는다
  const what = it.lifecycle_stage === 'pre_announcement' ? '접수' : '마감';
  return d === 0 ? `오늘 ${what}` : `${what} D-${d}`;
}

function md(d: string | null): string {
  if (!d) return '';
  const [, m, day] = d.split('-');
  return m && day ? `${Number(m)}.${Number(day)}` : '';
}

export default function SubscriptionCarousel({
  title,
  meta,
  items,
}: {
  title: string;
  meta?: string;
  items: RegionBlockItem[];
}) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const total = items.length;

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const w = card ? card.offsetWidth + 10 : el.clientWidth;
    setIdx(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / w))));
  }, [total]);

  if (total === 0) return null;

  return (
    <section className="sub-car" aria-label={title}>
      <div className="sub-car__head">
        <h2 className="sub-car__title">{title}</h2>
        {meta && <span className="sub-car__meta">{meta}</span>}
      </div>

      <div className="sub-car__track" ref={ref} onScroll={onScroll}>
        {items.map((it) => {
          const img = it.hero_image_url || it.cover_image_url || null;
          const stage = it.lifecycle_stage ? STAGE_LABEL[it.lifecycle_stage] : null;
          const dday = ddayOf(it);
          return (
            <Link
              key={it.id}
              href={`/apt/${encodeURIComponent(it.slug || it.id)}`}
              className={img ? 'sub-card' : 'sub-card sub-card--navy'}
            >
              {img && (
                <span className="sub-card__img">
                  {/* H7-3 ③ — 주소가 있어도 «안 열리면» 네이비 폴백으로 떨어진다. */}
                  <SafeImg src={img} />
                </span>
              )}
              <span className="sub-card__body">
                <span className="sub-card__top">
                  {stage && <span className="sub-card__stage">{stage}</span>}
                  {dday && <span className="sub-card__dday">{dday}</span>}
                </span>
                <span className="sub-card__name">{it.display_name || it.name}</span>
                <span className="sub-card__sub">
                  {/* B6 — 접수일을 «2줄에» 병기한다. 정렬·대표 날짜는 공고일이지만
                      사람이 달력에 적는 것은 접수일이다. 둘 다 사실이고 서로 다르다. */}
                  {[
                    it.sigungu,
                    it.total_units ? `${it.total_units.toLocaleString()}세대` : '',
                    it.rcept_bgnde ? `접수 ${md(it.rcept_bgnde)}` : '',
                  ].filter(Boolean).join(' · ')}
                </span>
                {it.announcement_date && <span className="sub-card__date">공고 {md(it.announcement_date)}</span>}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 진행 점은 모바일에서만 의미가 있다 — 데스크탑은 3장이 한눈에 보인다. */}
      <div className="sub-car__dots" aria-hidden="true">
        {items.map((it, i) => (
          <span key={it.id} className={i === idx ? 'is-on' : undefined} />
        ))}
      </div>
    </section>
  );
}
