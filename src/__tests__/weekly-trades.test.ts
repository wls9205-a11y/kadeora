// H4-2 자물쇠 — 라벨과 증감.
//
// 이 두 가지가 이 기능이 거짓말할 수 있는 «유일한» 지점이다.
//   · 라벨: 집계에 없는 지역을 있다고 쓰는 것 (경남이 3개월째 결측이다)
//   · 증감: prev_deals 를 잘못 다뤄 부호가 뒤집히는 것

import { describe, it, expect, vi, afterEach } from 'vitest';
import { tradeRegionLabel, tradeDeltaPct, shortDate, fetchWeeklyTrades } from '@/lib/home/weekly-trades';

/* RPC 를 갈아 끼우기 위한 모킹. 실제 Supabase 에 붙지 않는다. */
const rpcMock = vi.fn();
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({ rpc: (...a: unknown[]) => rpcMock(...a) }),
}));

describe('tradeRegionLabel — 센 지역만 말한다', () => {
  it('경남이 결측인 현재 상태는 「부산·울산」이다', () => {
    expect(tradeRegionLabel([{ region: '부산' }, { region: '울산' }])).toBe('부산·울산');
  });

  it('**세 지역이 다 들어오면 코드 수정 없이 「부울경」이 된다** — D5-5 복구 후 자동', () => {
    expect(tradeRegionLabel([{ region: '부산' }, { region: '울산' }, { region: '경남' }])).toBe('부울경');
  });

  it('건수 순서가 바뀌어도 라벨은 정본 순서로 고정된다', () => {
    // 울산이 부산을 앞지른 주. 라벨이 「울산·부산」으로 뒤집히면 안 된다.
    expect(tradeRegionLabel([{ region: '울산' }, { region: '부산' }])).toBe('부산·울산');
  });

  it('한 지역만 남아도 그 지역만 말한다', () => {
    expect(tradeRegionLabel([{ region: '부산' }])).toBe('부산');
  });

  it('정본 밖 지역이 섞여 와도 버리지 않는다 — 센 걸 안 적는 것도 거짓이다', () => {
    expect(tradeRegionLabel([{ region: '부산' }, { region: '경기' }])).toBe('부산·경기');
  });

  it('빈 목록이면 빈 문자열 — 호출부가 미렌더한다', () => {
    expect(tradeRegionLabel([])).toBe('');
    expect(tradeRegionLabel([{ region: '  ' }])).toBe('');
  });
});

describe('tradeDeltaPct — 부호가 뒤집히면 안 된다', () => {
  it('실측값(456 vs 성숙도 맞춘 275)은 +66% 다', () => {
    expect(tradeDeltaPct(456, 275)).toBe(66);
  });

  it('직전 «완숙» 창(507)을 그대로 쓰면 −10% 라 부호가 뒤집힌다 — 그래서 안 쓴다', () => {
    // 이 테스트는 회귀 방지용 기록이다. 507 을 넘기는 코드가 생기면 여기서 드러난다.
    expect(tradeDeltaPct(456, 507)).toBe(-10);
    expect(tradeDeltaPct(456, 275)).toBeGreaterThan(0);
  });

  it('prev 가 0이면 표시하지 않는다 — 0으로 나누지 않고 「신규」로 때우지도 않는다', () => {
    expect(tradeDeltaPct(456, 0)).toBeNull();
    expect(tradeDeltaPct(456, -1)).toBeNull();
  });

  it('NaN 이 들어와도 null 이다', () => {
    expect(tradeDeltaPct(Number.NaN, 275)).toBeNull();
    expect(tradeDeltaPct(456, Number.NaN)).toBeNull();
  });
});

describe('shortDate', () => {
  it('연도를 떼고 8/24 로 낸다', () => {
    expect(shortDate('2026-08-24')).toBe('8/24');
    expect(shortDate('2026-08-22T00:00:00Z')).toBe('8/22');
  });
  it('값이 없으면 빈 문자열 — 호출부가 그 조각을 생략한다', () => {
    expect(shortDate(null)).toBe('');
    expect(shortDate('')).toBe('');
  });
});

describe('fetchWeeklyTrades — 실패해도 홈을 무너뜨리지 않는다', () => {
  afterEach(() => { rpcMock.mockReset(); vi.restoreAllMocks(); });

  it('RPC 가 error 를 내면 null 을 내고 **console.error 를 남긴다** (침묵 금지)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchWeeklyTrades()).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('RPC 가 던져도 «reject 하지 않는다» — 호출부가 뭉치 밖에서 await 한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcMock.mockRejectedValue(new Error('network'));
    await expect(fetchWeeklyTrades()).resolves.toBeNull();
  });

  it('deals 가 0이면 null — 섹션을 만들지 않는다', async () => {
    rpcMock.mockResolvedValue({ data: [{ deals: 0, prev_deals: 0 }], error: null });
    await expect(fetchWeeklyTrades()).resolves.toBeNull();
  });

  it('빈 배열이 와도 null', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(fetchWeeklyTrades()).resolves.toBeNull();
  });

  it('RETURNS TABLE 이라 «행 배열» 로 오는 걸 첫 행으로 읽는다', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        deals: 456, prev_deals: 275, cutoff: '2026-08-22',
        latest_deal_date: '2026-08-24', lag_days: 2,
        by_region: [{ region: '부산', deals: 325 }, { region: '울산', deals: 131 }],
        stale_regions: [{ region: '경남', last_seen: '2026-05-27' }],
      }],
      error: null,
    });
    const r = await fetchWeeklyTrades();
    expect(r?.deals).toBe(456);
    expect(r?.byRegion.map((x) => x.region)).toEqual(['부산', '울산']);
    expect(r?.staleRegions[0]?.region).toBe('경남');
    // 인자를 넘기지 않는다 — p_days·p_settle_days 기본값이 정본이다.
    expect(rpcMock).toHaveBeenCalledWith('get_bugyeong_weekly_trades');
  });

  it('by_region 이 배열이 아니어도 터지지 않는다', async () => {
    rpcMock.mockResolvedValue({
      data: [{ deals: 10, prev_deals: 5, by_region: null, stale_regions: undefined }],
      error: null,
    });
    const r = await fetchWeeklyTrades();
    expect(r?.byRegion).toEqual([]);
    expect(r?.staleRegions).toEqual([]);
  });
});
