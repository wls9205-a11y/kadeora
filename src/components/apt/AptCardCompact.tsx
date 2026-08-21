// src/components/apt/AptCardCompact.tsx — s259
// 컴팩트 카드 — 이미지 1장 + 핵심 정보 6개 (사용자 답변 기준)
// 1) 단지명 + 지역 + 시공사
// 2) 청약 시작/마감 + D-day
// 3) 세대수 + 평형 라인업
// 4) 평당가 + 공급가 범위
// 5) 이미지 1장
// 6) 태그 (마감임박/신규/규제 등)

import Link from "next/link";
import Image from "next/image";
import type { AptCard, AptCardCategory } from "@/lib/apt/card-types";
import {
  formatDday,
  formatDateRange,
  formatPricePerPyeong,
  formatSupplyRange,
  formatAreaLineup,
  formatHouseholds,
  formatRegionShort,
  formatTag,
  TAG_TONE_CLASS,
} from "@/lib/apt/card-format";
import LifecycleRail from "@/components/apt/LifecycleRail";

const CATEGORY_HREF: Record<AptCardCategory, (slug: string) => string> = {
  subscription: (s) => `/apt/${encodeURIComponent(s)}`,
  imminent:     (s) => `/apt/${encodeURIComponent(s)}`,
  redev:        (s) => `/apt/redev/${s}`,
  unsold:       (s) => `/apt/unsold/${s}`,
  complex:      (s) => `/apt/complex/${s}`,
};

const PLACEHOLDER_IMAGE = "/images/apt-placeholder.png";

/**
 * s2 — 카드 status 를 레일 단계로. AptCard 는 발표/계약/입주 날짜를 들고 있지 않아
 * 날짜 파생만으로는 마감 이후를 구분하지 못한다. status 를 폴백 stage 로 넘긴다.
 * 청약 라인이 아닌 카테고리는 NON_SUBSCRIPTION 단계로 보내 레일을 감춘다.
 */
const STATUS_STAGE: Record<string, string | null> = {
  ongoing: 'subscription_open',
  upcoming: 'pre_announcement',
  closed: 'award_announced',
  unsold: 'unsold_active',
  redev: 'redevelopment_active',
  existing: 'active_trade',
  unknown: null,
};

export default function AptCardCompact({
  card,
  category,
  priority = false,
}: {
  card: AptCard;
  category: AptCardCategory;
  priority?: boolean;
}) {
  const dday = formatDday(card.dday_end);
  // D-day pill 색 — hex/Tailwind 팔레트 대신 상태 토큰만 사용.
  // 이 pill 은 상태(접수중/선착순)가 아니라 마감까지 남은 일수 축이라,
  // 임박(urgent)=--status-soon, 여유 있는 접수중(soon)=--status-open,
  // 그 밖(normal)=브랜드 톤, 지남(past)=--status-closed 로 맞춘다.
  // 상태 자체의 4색 매핑은 subscription-badge.ts 의 STATUS_STYLE 이 담당한다.
  const ddayToneStyle = {
    urgent: { background: 'var(--status-soon)', color: 'var(--text-inverse)' },
    soon:   { background: 'var(--status-open)', color: 'var(--text-inverse)' },
    normal: { background: 'var(--brand-bg)',    color: 'var(--status-fcfs)' },
    past:   { background: 'var(--bg-elevated)', color: 'var(--status-closed)' },
    none:   undefined,
  }[dday.tone];

  const href = CATEGORY_HREF[category](card.slug_id || String(card.id));
  const visibleTags = (card.tags ?? []).slice(0, 3);

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* 이미지 영역 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <Image
          src={card.cover_image_url || PLACEHOLDER_IMAGE}
          alt={card.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition group-hover:scale-105"
          priority={priority}
        />
        {/* 좌상단 D-day 배지 */}
        {dday.tone !== "none" && (
          <div
            className="absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-bold tabular-nums"
            style={{ ...ddayToneStyle, fontFamily: 'var(--font-mono)' }}
          >
            {dday.label}
          </div>
        )}
        {/* 우상단 태그들 */}
        {visibleTags.length > 0 && (
          <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1 max-w-[60%]">
            {visibleTags.map((t) => {
              const meta = formatTag(t);
              return (
                <span
                  key={t}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TAG_TONE_CLASS[meta.tone] ?? TAG_TONE_CLASS.gray}`}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 텍스트 영역 — 컴팩트 (5 줄) */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 text-sm">
        {/* (1) 단지명 */}
        <h3 className="line-clamp-1 font-bold text-gray-900">
          {card.name}
        </h3>

        {/* (2) 지역 · 시공사 */}
        <p className="line-clamp-1 text-xs text-gray-500">
          {formatRegionShort(card.region)}
          {card.builder && card.builder !== "-" && (
            <span className="mx-1.5 text-gray-300">·</span>
          )}
          {card.builder !== "-" && <span>{card.builder}</span>}
        </p>

        {/* (3) 청약 일정 */}
        {(card.date_start || card.date_end) && (
          <p className="text-xs text-gray-700">
            <span className="text-gray-400">청약</span>{" "}
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatDateRange(card.date_start, card.date_end)}
            </span>
          </p>
        )}

        {/* (4) 세대수 · 평형 라인업 */}
        <p className="text-xs text-gray-700 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {formatHouseholds(card.households)}
          {card.area_lineup && card.area_lineup.length > 0 && (
            <>
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="text-gray-500">
                {formatAreaLineup(card.area_lineup)}
              </span>
            </>
          )}
        </p>

        {/* (5) 평당가 + 공급가 범위 — 가장 두드러지게 */}
        {(card.price_per_pyeong || card.supply_min || card.supply_max) && (
          <p className="mt-auto pt-1 text-sm">
            {card.price_per_pyeong ? (
              <span className="font-bold text-gray-900 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatPricePerPyeong(card.price_per_pyeong)}
              </span>
            ) : null}
            {(card.supply_min || card.supply_max) && (
              <span className="ml-2 text-xs text-gray-500 tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                ({formatSupplyRange(card.supply_min, card.supply_max)})
              </span>
            )}
          </p>
        )}

        {/* 분양 진행 눈금자 — 청약 라인이 아니면 스스로 null 을 반환한다 */}
        <div className="pt-2">
          <LifecycleRail
            stage={STATUS_STAGE[card.status] ?? null}
            dates={{ rcept_bgnde: card.date_start, rcept_endde: card.date_end }}
            size="mini"
          />
        </div>
      </div>
    </Link>
  );
}

// 카드 그리드 — 페이지에서 매핑할 때 사용
export function AptCardGrid({
  cards,
  category,
}: {
  cards: AptCard[];
  category: AptCardCategory;
}) {
  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((c, i) => (
        <AptCardCompact
          key={`${category}-${c.id}`}
          card={c}
          category={category}
          priority={i < 4}
        />
      ))}
    </div>
  );
}
