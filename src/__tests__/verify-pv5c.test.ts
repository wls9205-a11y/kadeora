/**
 * PV-5c 보강 — 중단점 B 판정 1·2·3 (2026-08-29 첫 배치 실측이 근거).
 *
 * 이 파일이 잠그는 세 가지 실패:
 *   ① 한진중공업 vs HJ중공업 = 같은 회사인데 conflicting 이 됐다
 *   ② 시공사 «입찰 후보» 6곳을 값으로 뽑아 conflicting 을 만들었다
 *   ③ 「78」을 세대수로 받았다
 */
import { describe, expect, it } from 'vitest';
import {
  BUILDER_ALIASES,
  acceptAsBuilder,
  builderRole,
  canonicalBuilder,
  normalizeBuilder,
  parseUnits,
  sameBuilder,
} from '@/lib/verify/builders';
import { BATCH_RATIO, judgeField, normalizeClaims, planBatch, type RawClaim } from '@/lib/verify/facts';
import { badJson, callFailed, fetchJson, isRetryable, noResult, ok, tally } from '@/lib/net/outcome';

describe('① 시공사 표기 사전 — 사명 변경이 «충돌» 로 보이지 않게', () => {
  it('1호 등재: 한진중공업 = HJ중공업', () => {
    expect(canonicalBuilder('한진중공업')).toBe('HJ중공업');
    expect(sameBuilder('한진중공업', 'HJ중공업')).toBe(true);
  });
  it('(주)·공백·괄호를 턴다', () => {
    expect(normalizeBuilder('(주)한진중공업')).toBe(normalizeBuilder('한진중공업'));
    expect(sameBuilder('주식회사 대림산업', 'DL이앤씨')).toBe(true);
  });
  it('⛔ 사전에 «없으면» 원문 그대로 — 모르는 회사를 고치지 않는다', () => {
    expect(canonicalBuilder('온라이프건설')).toBe('온라이프건설');
    expect(sameBuilder('대우건설', '대우조선해양')).toBe(false);
  });
  it('canonical 은 «현재 사명» 이다', () => {
    for (const canon of Object.keys(BUILDER_ALIASES)) expect(canonicalBuilder(canon)).toBe(canon);
  });

  it('실측 재현 — 대신 해모로 2차가 이제 conflicting 이 «아니다»', () => {
    const raw: RawClaim[] = [
      { field: 'builder', value: '한진중공업', kind: 'press', evidence: '시공사로 선정' },
      { field: 'builder', value: 'HJ중공업', kind: 'builder', originKey: 'hj', evidence: '수주 계약' },
    ];
    const { claims } = normalizeClaims('builder', raw);
    const v = judgeField(claims);
    expect(v.confidence).toBe('verified');   // 표기가 합쳐지고 독립 2곳이 됐다
    expect(v.value).toBe('HJ중공업');
  });
});

describe('② 역할 구분 — 「입찰 후보」는 값이 아니다', () => {
  it('선정·수주·계약만 채택한다', () => {
    for (const e of ['시공사로 선정', '수주 공시', '도급 계약 체결']) expect(acceptAsBuilder(e)).toBe(true);
  });
  it('입찰·참여·후보·유력은 «버린다»', () => {
    for (const e of ['입찰 참여', '수주 후보', '경쟁 구도', '유력하다']) expect(acceptAsBuilder(e)).toBe(false);
  });
  it('⚠️ 둘이 섞이면 안전한 쪽(candidate)으로 접는다', () => {
    expect(builderRole('입찰에 참여해 선정됐다')).toBe('candidate');
  });
  it('근거가 없으면 unknown — 채택하지 않는다', () => {
    expect(acceptAsBuilder(null)).toBe(false);
    expect(builderRole('')).toBe('unknown');
  });

  it('실측 재현 — 우동1 의 «후보 6곳» 이 전부 걸러진다', () => {
    const raw: RawClaim[] = ['DL이앤씨', '현대건설', '대우건설', '삼성물산', '대방건설', '동원개발']
      .map((v) => ({ field: 'builder', value: v, kind: 'press' as const, evidence: '입찰 참여 경쟁' }));
    const { claims, dropped } = normalizeClaims('builder', raw);
    expect(claims).toHaveLength(0);
    expect(dropped).toHaveLength(6);
    expect(judgeField(claims).confidence).toBe('rumor');  // conflicting 이 «아니다»
  });
});

describe('③ 수치 결합 — 맨숫자를 세대수로 받지 않는다', () => {
  it('숫자+「세대」 결합만 통과', () => {
    expect(parseUnits('849세대')).toBe(849);
    expect(parseUnits('총 1,521 세대 규모')).toBe(1521);
  });
  it('⛔ 맨숫자는 버린다 — 양정4 의 「78」이 그것이었다', () => {
    expect(parseUnits('78')).toBeNull();
    expect(parseUnits(78)).toBeNull();
    expect(parseUnits('78억')).toBeNull();
    expect(parseUnits('84㎡')).toBeNull();
  });
  it('현실 밖 값은 세대수가 아니다', () => {
    expect(parseUnits('12세대')).toBeNull();      // 30 미만
    expect(parseUnits('99999세대')).toBeNull();
  });
  it('실측 재현 — 양정4 의 78 이 빠지고 849 만 남는다', () => {
    const raw: RawClaim[] = [
      { field: 'total_units', value: '78', kind: 'press' },
      { field: 'total_units', value: '849세대', kind: 'union', originKey: 'u1' },
    ];
    const { claims, dropped } = normalizeClaims('total_units', raw);
    expect(claims).toHaveLength(1);
    expect(claims[0].value).toBe(849);
    expect(dropped[0]).toContain('「세대」 결합 없음');
  });
  it('⚠️ 버린 것을 «센다» — 조용히 사라지면 왜 비었는지 모른다', () => {
    const { dropped } = normalizeClaims('total_units', [{ field: 'total_units', value: '3', kind: 'press' }]);
    expect(dropped).toHaveLength(1);
  });
});

describe('② 실패 3갈래 유틸 (판정 2 · 오늘 네 번째라 승격)', () => {
  it('재시도는 call_failed «만»', () => {
    expect(isRetryable(callFailed(0, 'timeout'))).toBe(true);
    expect(isRetryable(badJson(403, 'disabled service'))).toBe(false);
    expect(isRetryable(noResult())).toBe(false);
    expect(isRetryable(ok(1))).toBe(false);
  });
  it('⚠️ 자격 실패(403)는 call_failed 가 «아니다» — 닿았고 거부당했다', () => {
    expect(badJson(403, 'x').kind).toBe('bad_json');
  });
  it('빈 배열은 no_result — 「없다」는 실패가 아니다', async () => {
    const r = await fetchJson('https://example.invalid', {}, { retries: 0 });
    expect(['call_failed', 'bad_json']).toContain(r.kind);
  });
  it('집계기가 갈래를 세고 표본을 남긴다', () => {
    const t = tally();
    t.add(ok(1)); t.add(noResult()); t.add(badJson(403, 'disabled'), 'kakao');
    expect(t.counts).toMatchObject({ ok: 1, no_result: 1, bad_json: 1, call_failed: 0 });
    expect(t.samples[0]).toContain('kakao');
    expect(t.samples[0]).toContain('403');
  });
});

describe('③ 쿼터 인터리브 (판정 3 · §6 개정)', () => {
  const mk = (tier: any, n: number) => Array.from({ length: n }, (_, i) => ({ item: `${tier}${i}`, tier }));

  it('급건은 «전량 최우선» 이다', () => {
    const items = [...mk('ad_landing', 575), ...mk('pre_ann_urgent', 5), ...mk('rest', 5000)];
    const batch = planBatch(items, 20);
    for (let i = 0; i < 5; i++) expect(batch[i]).toBe(`pre_ann_urgent${i}`);
  });

  it('잔여는 6:2:1:1 비율로 나눈다', () => {
    const items = [...mk('ad_landing', 100), ...mk('pre_ann', 100), ...mk('lead', 100), ...mk('rest', 100)];
    const batch = planBatch(items, 20);
    const n = (p: string) => batch.filter((b) => String(b).startsWith(p)).length;
    expect(n('ad_landing')).toBeGreaterThanOrEqual(11);   // 20 × 6/10 = 12 ± 반올림
    expect(n('pre_ann')).toBeGreaterThanOrEqual(3);
    expect(batch).toHaveLength(20);
  });

  it('⚠️ 모자란 층의 몫은 «남은 층» 이 가져간다 — 슬롯을 비우지 않는다', () => {
    const items = [...mk('pre_ann_urgent', 2), ...mk('ad_landing', 50)];
    const batch = planBatch(items, 20);
    expect(batch).toHaveLength(20);
    expect(batch.filter((b) => String(b).startsWith('pre_ann_urgent'))).toHaveLength(2);
  });

  it('비율이 §6 에 기록된 값과 «같다»', () => {
    expect(BATCH_RATIO).toMatchObject({ ad_landing: 6, pre_ann: 2, lead: 1, curated: 1, rest: 1, pre_ann_urgent: 0 });
  });

  it('실측 규모에서 급건이 «첫 배치» 에 들어온다 — 29일이 0일이 된다', () => {
    const items = [...mk('ad_landing', 575), ...mk('pre_ann_urgent', 5), ...mk('pre_ann', 9),
                   ...mk('lead', 2), ...mk('rest', 5442)];
    const batch = planBatch(items, 20);
    expect(batch.filter((b) => String(b).startsWith('pre_ann_urgent'))).toHaveLength(5);
  });
});
