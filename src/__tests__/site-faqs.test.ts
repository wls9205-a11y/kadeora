/**
 * AB-2 조립 FAQ 규격 게이트 (K-1 ② · 2026-09-16).
 *
 * 이 파일이 지키는 것은 문장의 «취향» 이 아니라 규격 4조건이다.
 * 조립기는 AI 를 부르지 않으므로, 여기가 통과하면 환각은 구조적으로 불가능하다.
 */
import { describe, it, expect } from 'vitest';
import { buildSiteFaqs } from '@/lib/apt/site-faqs';

const 트라비스 = {
  name: '엄궁역 트라비스 하늘채',
  slug: '엄궁역-트라비스-하늘채',
  region: '부산', sigungu: '사상구', dong: '엄궁동',
  builder: '코오롱글로벌',
  siteType: 'subscription',
  stageLabel: '공사중',
  totalUnits: 1670,      // 그랑라크 규약: 총 = complex
  generalUnits: 1061,    // 일반분양 = general
};

const 거제 = {
  name: '거제 옥포 공동주택',
  slug: '거제-옥포-공동주택',
  region: '경남', sigungu: '거제시',
  builder: '현대엔지니어링(주)',
  siteType: 'subscription',
  stageLabel: '분양예정',
  totalUnits: 1963,
  schedule: { label: '분양예정 시기', text: '2026년 10월', source: 'news', asof: '2026-09-14' },
};

describe('AB-2 ① 정의형 첫 문장', () => {
  it('첫 문항의 답이 「…은(는) …입니다」 정의문으로 시작한다', () => {
    const f = buildSiteFaqs(트라비스);
    expect(f[0].a).toMatch(/^엄궁역 트라비스 하늘채은\(는\) .*입니다\./);
    expect(f[0].a).toContain('부산 사상구 엄궁동에 들어서는');
    expect(f[0].a).toContain('코오롱글로벌의');
  });

  it('이름만 있어도 첫 문항은 선다', () => {
    const f = buildSiteFaqs({ name: '이름뿐', slug: 'x' });
    expect(f.length).toBeGreaterThanOrEqual(1);
    expect(f[0].a).toContain('이름뿐은(는)');
  });

  it('이름이 없으면 «아무 문항도» 만들지 않는다', () => {
    expect(buildSiteFaqs({ name: '  ', slug: 'x' })).toEqual([]);
  });
});

describe('AB-2 ② 기준일 괄호 병기', () => {
  it('일정 문항에 출처·기준일이 괄호로 붙는다', () => {
    const f = buildSiteFaqs(거제);
    const sch = f.find((x) => x.a.includes('2026년 10월'));
    expect(sch?.a).toContain('(news · 2026-09-14 기준)');
  });

  it('기준일이 없으면 괄호를 «비워서» 붙이지 않는다', () => {
    const f = buildSiteFaqs({ ...거제, schedule: { label: '분양예정 시기', text: '2026년 10월' } });
    const sch = f.find((x) => x.a.includes('2026년 10월'));
    // ⚠️ 「은(는)」 조사 병기의 괄호와 헷갈리지 않게 «꼬리» 만 본다.
    expect(sch?.a).not.toContain('기준)');
    expect(sch?.a).not.toMatch(/\(\s*\)/);
    expect(sch?.a).toBe('분양예정 시기은(는) 2026년 10월입니다.');
  });
});

describe('AB-2 ③ 미공개면 금액 문항 «자체를» 만들지 않는다', () => {
  it('priceText 가 없으면 분양가 문항이 아예 없다', () => {
    const f = buildSiteFaqs(트라비스);
    expect(f.some((x) => x.q.includes('분양가'))).toBe(false);
  });

  it('⛔ 「미정」·「미확인」 같은 자리표시를 어느 문항에도 쓰지 않는다', () => {
    for (const input of [트라비스, 거제, { name: '빈현장', slug: 'empty' }]) {
      for (const x of buildSiteFaqs(input)) {
        expect(x.a).not.toMatch(/미정|미확인|확인 중|정보 없음|-\s*입니다/);
      }
    }
  });

  it('priceText 가 있으면 그때만 문항이 생긴다', () => {
    const f = buildSiteFaqs({ ...트라비스, priceText: '4.9억 ~ 14.6억' });
    const p = f.find((x) => x.q.includes('분양가'));
    expect(p?.a).toContain('4.9억 ~ 14.6억');
  });
});

describe('AB-2 ④ 일반분양에 「구역」을 쓰지 않는다', () => {
  it('subscription 현장의 문면에 「구역」이 없다', () => {
    for (const x of buildSiteFaqs(트라비스)) {
      expect(`${x.q} ${x.a}`).not.toContain('구역');
    }
  });

  it('정비사업 현장에는 「구역」을 쓴다', () => {
    const f = buildSiteFaqs({ ...트라비스, siteType: 'redevelopment' });
    expect(f[0].a).toContain('정비사업 구역입니다');
  });
});

describe('그랑라크 규약 — 총과 일반분양이 다르면 «둘 다» 말한다', () => {
  it('총 1,670 · 일반분양 1,061 이 한 문장에 함께 나온다', () => {
    const f = buildSiteFaqs(트라비스);
    const u = f.find((x) => x.q.includes('세대수'));
    expect(u?.a).toContain('총 1,670세대');
    expect(u?.a).toContain('일반분양은 1,061세대');
  });

  it('총과 일반분양이 같으면 한 번만 말한다', () => {
    const f = buildSiteFaqs({ ...트라비스, generalUnits: 1670 });
    const u = f.find((x) => x.q.includes('세대수'));
    expect(u?.a).toBe('총 1,670세대입니다.');
  });
});

describe('문두 로테이션 — 현장별 고정, 현장끼리 분산', () => {
  it('같은 현장은 «몇 번을 불러도» 같은 문면이다 (캐시·회귀가 흔들리지 않게)', () => {
    expect(buildSiteFaqs(트라비스)).toEqual(buildSiteFaqs(트라비스));
  });

  it('slug 가 다르면 문형이 갈린다 — 전 현장 동일 문형은 중복 신호를 부른다', () => {
    const 문두 = (slug: string) =>
      buildSiteFaqs({ name: '같은이름', slug }).map((x) => x.q).join('|');
    const 표본 = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(문두));
    expect(표본.size).toBeGreaterThan(1);
  });
});
