// §2-2 / §4-4 회귀 자물쇠.
//
// 두 가지가 조용히 깨지면 자동발행이 통째로 멈춘다:
//   ① extractAptSiteSlugs 가 본문에서 현장 링크를 못 뽑으면 발행 게이트에 걸린다
//   ② 제목이 80자를 넘으면 DB 트리거가 막는데, 그 오류가 duplicate_slug 로 보고돼
//      "슬러그 중복" 으로 오진된다 (실제로 §4-4 에서 그렇게 진단됐다)

import { describe, it, expect } from 'vitest';
import { extractAptSiteSlugs } from '@/lib/blog-safe-insert';
import { fitTitle, TITLE_MAX } from '@/lib/blog/title-fit';

describe('extractAptSiteSlugs — 발행 게이트가 보는 링크', () => {
  it('크론이 만드는 마크다운 줄에서 슬러그를 뽑는다', () => {
    // blog-weekly-movers / blog-district-redev 가 실제로 내보내는 형태 그대로다.
    const body = [
      '- [센트레빌 아스테리움 거제](/apt/센트레빌-아스테리움-거제) — 당첨자 발표 → 계약',
      '  경남 거제시 · 동부건설(주) · 일반분양 1,307세대',
      '- [광안2 재개발](/apt/광안2-재개발) — 착공',
    ].join('\n');

    expect(extractAptSiteSlugs(body)).toEqual([
      '센트레빌-아스테리움-거제',
      '광안2-재개발',
    ]);
  });

  it('허브 링크는 세지 않는다 — 인정하면 게이트가 100% 통과한다', () => {
    // enrichContent 가 모든 글에 자동으로 넣는 줄이다.
    const body = '> 🏠 [카더라 청약 일정 확인](/apt) | [분양 정보 보기](/apt?tab=ongoing)';
    expect(extractAptSiteSlugs(body)).toEqual([]);
  });

  it('실제 라우트 경로는 현장이 아니다', () => {
    const body = '[단지 백과](/apt/complex/재동타워) [지도](/apt/map) [아카이브](/apt/archive)';
    expect(extractAptSiteSlugs(body)).toEqual([]);
  });

  it('href 형태와 중복도 처리한다', () => {
    const body = '<a href="/apt/광안2-재개발">광안2</a> 그리고 [다시](/apt/광안2-재개발)';
    expect(extractAptSiteSlugs(body)).toEqual(['광안2-재개발']);
  });
});

describe('fitTitle — 80자 게이트', () => {
  const render = (picked: string[]) =>
    picked.length > 0
      ? `전국 이번 주 움직인 현장 — ${picked.join(', ')} 등 83곳 (2026년 8월 4주)`
      : `전국 이번 주 움직인 현장 83곳 (2026년 8월 4주)`;

  it('짧은 이름 3개는 그대로 들어간다', () => {
    const t = fitTitle(['광안2', '남천3', '범천1'], render);
    expect(t).toContain('광안2, 남천3, 범천1');
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('긴 단지명이면 개수를 줄여서라도 80자에 맞춘다', () => {
    // §4-4 를 실제로 막았던 형태 — 아파트명은 구역명보다 훨씬 길다.
    const long = [
      '인천 미추홀구 시티오씨엘 9단지 오션파크뷰',
      '부산 수영구 남천2-3(삼익비치) 재건축',
      '센트레빌 아스테리움 거제',
    ];
    const t = fitTitle(long, render);
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(t).toContain('전국 이번 주 움직인 현장');
  });

  it('이름이 없어도 유효한 제목을 낸다', () => {
    const t = fitTitle([], render);
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(t.length).toBeGreaterThanOrEqual(10);
  });

  it('어떤 입력에서도 80자를 넘기지 않는다', () => {
    const absurd = Array.from({ length: 5 }, (_, i) => `아주아주긴단지이름${i}`.repeat(6));
    expect(fitTitle(absurd, render).length).toBeLessThanOrEqual(TITLE_MAX);
  });
});
