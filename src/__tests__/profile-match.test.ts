// 같은 이름 단지 오집 방지 자물쇠.
//
// 여기서 고른 프로필의 시세가 blog_posts.meta_description 으로 «검색 결과에» 나간다.
// 틀리면 색인에 남으므로, «못 고르면 안 고르는» 쪽이 정답이다.

import { describe, it, expect } from 'vitest';
import { pickProfileByTags } from '@/lib/apt/profile-match';

const busan = { sigungu: '해운대구', region_nm: '부산', latest_sale_price: 100 };
const seoul = { sigungu: '양천구', region_nm: '서울', latest_sale_price: 200 };
const seoul2 = { sigungu: '도봉구', region_nm: '서울', latest_sale_price: 300 };

describe('pickProfileByTags', () => {
  it('후보가 하나면 그대로 쓴다 — 이름이 유일한 흔한 경우', () => {
    expect(pickProfileByTags([busan], ['아무거나'])).toBe(busan);
  });

  it('태그의 시군구로 고른다 (자리와 무관하게)', () => {
    // 실측 태그 모양: 단지명 다음이 시도, 그다음이 시군구
    expect(pickProfileByTags([busan, seoul], ['이펜하우스3단지', '서울', '양천구', '실거래가'])).toBe(seoul);
    // 시군구가 뒤쪽에 파묻혀 있어도 잡는다
    expect(pickProfileByTags([busan, seoul], ['레이카운티', '줍줍', '해운대구', '부산'])).toBe(busan);
  });

  it('시군구로 못 가리면 시도로 한 번 더 좁힌다', () => {
    // 태그에 시군구가 없고 시도만 있다
    expect(pickProfileByTags([busan, seoul], ['단지', '부산', '실거래가'])).toBe(busan);
  });

  it('**여전히 여럿이면 null — 찍지 않는다**', () => {
    // 같은 시도에 후보가 둘이고 시군구 태그가 없다
    expect(pickProfileByTags([seoul, seoul2], ['단지', '서울', '실거래가'])).toBeNull();
  });

  it('태그가 비면 여러 후보 중에 고르지 않는다', () => {
    expect(pickProfileByTags([busan, seoul], [])).toBeNull();
    expect(pickProfileByTags([busan, seoul], null)).toBeNull();
  });

  it('후보가 없으면 null', () => {
    expect(pickProfileByTags([], ['부산'])).toBeNull();
    expect(pickProfileByTags(null, ['부산'])).toBeNull();
  });

  it('공백·null 태그가 섞여도 터지지 않는다', () => {
    expect(pickProfileByTags([busan, seoul], ['  ', null, undefined, '양천구'])).toBe(seoul);
  });
});
