/**
 * LB-1/LB-3 L1 — 쿼터 판정·카테고리 태깅 (2026-09-08).
 *
 * ⚠️ AI 도 DB 도 부르지 않는다. 이 층이 틀리면 1:9 가 «조용히» 무너지고,
 *    조용한 실패는 다이제스트가 숫자를 들고 올 때까지 일주일을 간다.
 */
import { describe, expect, it } from 'vitest';
import { costUsd, llmCategoryOfContent, quotaBlocked, stockCap, stockCostBlocked } from '@/lib/llm/gateway';

describe('LB-3 — 주식계열 상한 산식', () => {
  it('기본값 200 × 0.10 = 20', () => {
    expect(stockCap(200, 0.1)).toBe(20);
  });

  it('내림이다 — 「1할 보장」이 아니라 「9할을 부동산에」가 목표다', () => {
    expect(stockCap(15, 0.1)).toBe(1);
    expect(stockCap(9, 0.1)).toBe(0);
  });

  it('음수·이상값에서 0 밑으로 내려가지 않는다', () => {
    expect(stockCap(-10, 0.1)).toBe(0);
    expect(stockCap(100, -1)).toBe(0);
  });

  it('상한에 «도달하면» 막는다 — 초과가 아니라 도달이다', () => {
    expect(quotaBlocked(19, 20)).toBe(false);
    expect(quotaBlocked(20, 20)).toBe(true);
    expect(quotaBlocked(21, 20)).toBe(true);
  });

  it('상한 0 이면 첫 호출부터 막힌다', () => {
    expect(quotaBlocked(0, 0)).toBe(true);
  });
});

describe('LB-3 — 콘텐츠 카테고리 → 원장 카테고리', () => {
  it('부동산 계열은 realestate 로 모인다', () => {
    for (const c of ['apt', 'realestate', 'unsold']) {
      expect(llmCategoryOfContent(c)).toBe('realestate');
    }
  });

  it('주식은 stock', () => {
    expect(llmCategoryOfContent('stock')).toBe('stock');
  });

  it('⚠️ 부동산이 아닌 콘텐츠는 «쿼터 안» 이다 — 예외로 빼면 1:9 의 취지가 샌다', () => {
    for (const c of ['finance', 'economy', 'tax', 'life', 'general', null, undefined, '']) {
      expect(llmCategoryOfContent(c as any)).toBe('finance');
    }
  });

  it('모르는 값을 realestate 로 흘리지 않는다 — 그러면 9쪽이 조용히 부풀려진다', () => {
    expect(llmCategoryOfContent('알 수 없는 카테고리')).not.toBe('realestate');
  });
});

describe('FINAL_HC_20260913 B — 크레딧(가중 비용) 1:9', () => {
  // 단가는 테스트 픽스처일 뿐이다 — 정본은 app_config llm.model_prices.
  const prices = {
    'claude-haiku-4-5-20251001': { in: 1, out: 5 },
    'claude-opus-5': { in: 5, out: 25 },
  };

  it('입력·출력 단가를 따로 곱한다 — 출력이 많은 주식 글이 콜 수보다 무겁다', () => {
    const c = costUsd({ model: 'claude-haiku-4-5-20251001', input_tokens: 9413, output_tokens: 39866 }, prices);
    expect(c).toBeCloseTo(0.208743, 6);
  });

  it('캐시 토큰은 단가표에 없으면 in 의 1.25배(쓰기)·0.1배(읽기)', () => {
    const c = costUsd({ model: 'claude-opus-5', input_tokens: 0, output_tokens: 0, cache_creation_tokens: 1e6, cache_read_tokens: 1e6 }, prices);
    expect(c).toBeCloseTo(5 * 1.25 + 5 * 0.1, 6);
  });

  it('⚠️ 단가표에 없는 모델은 0 이 아니라 «최고가» 로 센다 — 0 이면 새 모델이 쿼터를 우회한다', () => {
    const c = costUsd({ model: 'claude-new-model', input_tokens: 0, output_tokens: 1e6 }, prices);
    expect(c).toBe(25);
  });

  it('단가표가 비면 0 (이때 관문은 calls 모드로 떨어진다)', () => {
    expect(costUsd({ model: 'x', input_tokens: 1, output_tokens: 1 }, {})).toBe(0);
  });

  it('주식 누적이 전체×share 에 «도달하면» 막는다', () => {
    expect(stockCostBlocked(0.49, 5, 0.1)).toBe(false);
    expect(stockCostBlocked(0.5, 5, 0.1)).toBe(true);
  });

  it('오늘 지출 0 이면 주식 첫 호출도 막힌다 — 9할이 먼저다 (그래서 스위치로만 켠다)', () => {
    expect(stockCostBlocked(0, 0, 0.1)).toBe(true);
  });

  it('9/12 원장 재현 — 콜 비중 31% 가 비용 비중으로는 57% (Opus 5 = $5/$25)', () => {
    const rows = [
      { category: 'finance', model: 'claude-haiku-4-5-20251001', input_tokens: 3948, output_tokens: 13826 },
      { category: 'realestate', model: 'claude-haiku-4-5-20251001', input_tokens: 52685, output_tokens: 10875 },
      { category: 'realestate', model: 'claude-opus-5', input_tokens: 11726, output_tokens: 1879 },
      { category: 'stock', model: 'claude-haiku-4-5-20251001', input_tokens: 9413, output_tokens: 39866 },
    ];
    let stock = 0, total = 0;
    for (const r of rows) {
      const c = costUsd(r, prices);
      total += c;
      if (r.category !== 'realestate') stock += c;
    }
    expect(stock / total).toBeCloseTo(0.57, 2);
  });
});
