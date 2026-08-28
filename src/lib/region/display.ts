import { BUGYEONG } from '@/lib/apt/pipeline';

/**
 * 화면에 낼 지역 이름.
 *
 * ── 왜 필요한가 ─────────────────────────────────────────────────────────────
 * RPC 가 받는 region 값에는 «내부 묶음» 인 '부울경' 이 있다(부산·울산·경남 벨트).
 * 그 값을 meta 문자열에 그대로 끼워 넣어 화면에 「부울경 360곳 · 진행 단계순」이
 * 나가고 있었다 — 2026-08-28 스모크가 /apt 세 자리에서 잡았다.
 *
 * ⛔ '부산·울산·경남' 으로 풀어 쓰지 «않는다». 그 표기도 금지 카피다.
 * ⛔ '부산' 으로 좁혀 쓰지도 «않는다». 실제 집계는 세 시도를 합친 값이라 거짓이 된다.
 *    → 지역 단어를 «빼는» 것이 유일하게 참인 선택이다. 어느 지역인지는 화면 위쪽
 *      지역 선택기가 이미 말하고 있다.
 *
 * ⚠️ region «값» 은 그대로 둔다. 이건 표시에서만 쓰는 함수다 —
 *    조회·정렬·쿠키에 이 결과를 넣지 말 것.
 */
export function regionLabel(region: string | null | undefined): string {
  if (!region) return '';
  if (region === BUGYEONG) return '';
  if (region === '전국') return '';
  return region;
}

/**
 * 「A · B · C」 형태의 보조 문구를 만든다. 빈 조각은 «항목째» 사라진다 —
 * 구분점만 남아 「· 360곳 · 진행 단계순」처럼 되지 않게 한다.
 */
export function metaLine(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(' · ');
}
