// 앵커 회전 가드.
//
// ⚠️ get_backlink_targets 의 variants 에는 `부산`·`푸르지오` 같은 **광범위 토큰**이 섞여 있다.
//    그걸 특정 현장 링크의 앵커로 쓰면 브랜드·지역 일반 검색어에 엉뚱한 현장이 매달린다.
//    조용히 나빠지는 종류라 자물쇠를 건다.

import { describe, it, expect } from 'vitest';
import { anchorPool, rotateAnchor } from '@/lib/blog/anchor';

describe('anchorPool — 식별 가능한 앵커만 남긴다', () => {
  // get_backlink_targets 실측값 그대로.
  const name = '창원 의창 푸르지오';
  const variants = ['의창', '창원', '창원 의창 푸르지오', '창원-의창-푸르지오', '창원의창푸르지오', '푸르지오'];

  it('지역·브랜드 단독 토큰을 버린다', () => {
    const pool = anchorPool(name, variants);
    expect(pool).not.toContain('창원');
    expect(pool).not.toContain('의창');
    expect(pool).not.toContain('푸르지오');
  });

  it('슬러그 형태를 버린다 — 사람이 읽는 문구가 아니다', () => {
    expect(anchorPool(name, variants)).not.toContain('창원-의창-푸르지오');
  });

  it('충분히 구체적인 변형은 남긴다', () => {
    const pool = anchorPool(name, variants);
    expect(pool).toContain('창원 의창 푸르지오');
    expect(pool).toContain('창원의창푸르지오');
  });

  it('원 이름은 항상 첫 번째다', () => {
    expect(anchorPool(name, variants)[0]).toBe(name);
    expect(anchorPool(name, [])[0]).toBe(name);
    expect(anchorPool(name, null)[0]).toBe(name);
  });

  it('부산 에코델타 롯데캐슬 — 같은 규칙', () => {
    const pool = anchorPool('부산 에코델타 롯데캐슬', [
      '롯데캐슬', '부산', '부산 에코델타 롯데캐슬', '부산-에코델타-롯데캐슬', '부산에코델타롯데캐슬', '에코델타',
    ]);
    expect(pool).not.toContain('부산');
    expect(pool).not.toContain('롯데캐슬');
    expect(pool).not.toContain('에코델타');
    expect(pool).toContain('부산에코델타롯데캐슬');
  });
});

describe('rotateAnchor — 같은 글에서 같은 앵커를 반복하지 않는다', () => {
  it('인덱스로 돌려 쓴다', () => {
    const name = '창원 의창 푸르지오';
    const variants = ['창원의창푸르지오', '창원', '푸르지오'];
    const a = rotateAnchor(name, variants, 0);
    const b = rotateAnchor(name, variants, 1);
    expect(a).toBe(name);
    expect(b).toBe('창원의창푸르지오');
  });

  it('후보가 없어도 앵커는 만들어진다', () => {
    expect(rotateAnchor('짧은이름', [], 3)).toBe('짧은이름');
  });
});
