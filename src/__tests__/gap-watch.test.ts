import { describe, it, expect } from 'vitest';
import {
  GAP_METRICS, digestSeverity, formatDigest, severityOf, type GapReading,
} from '@/lib/gap/metrics';
import { countSimilarPairs } from '@/app/api/cron/gap-watch/route';

const def = (k: string) => GAP_METRICS.find((m) => m.key === k)!;

describe('CV-4 갭워치 심각도', () => {
  it('lower_is_better — 절대 임계', () => {
    expect(severityOf(def('permits_unmatched'), 10)).toBe('ok');
    expect(severityOf(def('permits_unmatched'), 250)).toBe('warning');
    expect(severityOf(def('permits_unmatched'), 1465)).toBe('critical');
  });

  it('higher_is_better — 줄어드는 쪽이 사고다', () => {
    expect(severityOf(def('pre_announcement'), 31)).toBe('ok');
    expect(severityOf(def('pre_announcement'), 12)).toBe('warning');
    expect(severityOf(def('pre_announcement'), 3)).toBe('critical');
  });

  it('임계 아래라도 «급증» 은 잡는다 — 큰 값이 조용히 유지되는 것과 구분한다', () => {
    expect(severityOf(def('candidates_queued'), 40, 27)).toBe('warning');
    expect(severityOf(def('candidates_queued'), 29, 27)).toBe('ok');   // +2 는 잡음
  });

  it('분양예정이 급감하면 임계 위여도 경고한다', () => {
    expect(severityOf(def('pre_announcement'), 20, 31)).toBe('warning');
  });

  // ⚠️ 오늘 하루의 핵심 교훈이 여기 있다 — 0 이 건강을 뜻하지 않는다.
  it('측정 불가 지표는 0 이어도 «건강» 으로 올리지 않는다', () => {
    const d = def('redev_stale_180d');
    expect(d.blindNote).toBeTruthy();
    expect(severityOf(d, 0)).toBe('ok');
    expect(severityOf(d, 9999)).toBe('ok');      // 못 재는 동안은 울리지도 않는다
    const body = formatDigest([{ def: d, value: 0, prev: null }]);
    expect(body).toContain('측정 불가');
  });

  it('다이제스트는 손볼 것에 «할 일» 을 붙인다', () => {
    const readings: GapReading[] = [
      { def: def('permits_unmatched'), value: 1465, prev: 1465 },
      { def: def('pre_announcement'), value: 31, prev: 28 },
    ];
    const body = formatDigest(readings, '2026-09-01T00:00:00Z');
    expect(body).toContain('손볼 것 1건');
    expect(body).toContain('(변화 없음)');
    expect(body).toContain('(+3)');
    expect(body).toContain('백필·매칭 대상');
    expect(digestSeverity(readings)).toBe('critical');
  });

  it('첫 관측은 델타를 지어내지 않는다', () => {
    expect(formatDigest([{ def: def('candidates_queued'), value: 27, prev: null }])).toContain('(첫 관측)');
  });
});

describe('같은 법정동 유사쌍', () => {
  const site = (id: string, name: string, dong = '남천동') =>
    ({ id, name, region: '부산', sigungu: '수영구', dong });

  it('같은 동의 포함 관계를 쌍으로 센다', () => {
    const r = countSimilarPairs([site('1', 'e편한세상 사하'), site('2', 'e편한세상 사하 2차')]);
    expect(r.pairs).toBe(1);
  });

  it('동이 다르면 세지 않는다 — 지역 울타리는 CV-B ② 와 같은 원칙', () => {
    expect(countSimilarPairs([site('1', 'e편한세상 사하'), site('2', 'e편한세상 사하 2차', '괴정동')]).pairs).toBe(0);
  });

  it('동이 없는 행은 세지 않는다 — null 을 같음으로 세지 않는다', () => {
    const rows = [site('1', '무명 단지'), { ...site('2', '무명 단지'), dong: null }];
    expect(countSimilarPairs(rows as never).pairs).toBe(0);
  });

  it('짧은 이름은 세지 않는다 — 세 글자짜리가 서로 다 걸린다', () => {
    expect(countSimilarPairs([site('1', '자이'), site('2', '자이 2')]).pairs).toBe(0);
  });
});
