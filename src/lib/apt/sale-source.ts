// 분양예정시기 «출처» 라벨 — enum 을 사람 말로.
//
// ⛔ 원시 enum(`permit`·`news`…)을 화면에 그대로 내지 않는다. 시스템 용어는 라벨이 아니다
//    (DS_RULES §2 — 「라벨은 시스템 용어가 아니라 사용자 언어」).
// ⚠️ `permit` 의 표기는 §7-1 이 «문구까지» 정한다 — 「출처: 국토교통부 건축HUB」.
//    공공데이터 이용조건상 출처 표기 의무가 있어 임의로 줄이지 않는다.

import type { ExpectedSaleSource } from '@/types/apt-sites';

const LABEL: Record<ExpectedSaleSource, string> = {
  permit: '국토교통부 건축HUB',
  announcement: '입주자모집공고',
  builder: '시공사 발표',
  news: '언론 보도',
  admin: '카더라 확인',
};

/** 모르는 값이면 null — 「기타」 같은 말을 지어내지 않는다. */
export function saleSourceLabel(s: string | null | undefined): string | null {
  if (!s) return null;
  return (LABEL as Record<string, string>)[s] ?? null;
}
