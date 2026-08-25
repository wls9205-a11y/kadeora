/**
 * T1 §1 — 확정 규격 레이아웃(A안)의 단일 구현.
 *
 * og-blog 카드1 · og-square · og-calc 가 이걸 쓴다. 같은 JSX 를 세 곳에 복붙하면
 * 반드시 갈라진다 — §3.3 이 공용 모듈을 요구한 이유가 그것이다.
 *
 * 구성은 위에서부터 딱 셋이다.
 *   1) 카테고리 띠  — 전폭, frame × 0.026. 이게 «유일한» 카테고리 표시다.
 *   2) 제목         — 정중앙, fitFontSize 계산값, 골드 강조줄 한 줄.
 *   3) KADEORA      — 하단 중앙.
 *
 * ⚠️ 배지·pill·아이콘·로고 사각형·골드 밑줄·도메인·날짜를 추가하지 말 것 (§1.5, §6.7).
 * ⚠️ textShadow 금지 (§6.6). 이모지 금지 (§4).
 */
import {
  accentIndex,
  barHeight,
  brandStyle,
  brandSurface,
  BRAND_WORDMARK,
  fitFontSize,
  titleLineStyle,
} from './brand';

export interface BrandCardOpts {
  /** §2 titleLines 결과. 2~3줄. */
  lines: string[];
  /** 캔버스 가로. */
  frame: number;
  /** 캔버스 세로. 정사각이면 생략. */
  height?: number;
  /** §1.2 카테고리 띠 색. */
  bar: string;
  /** 제목 아래에 붙는 요소 — og-calc 결과값처럼 이 카드의 «본체» 인 값만. */
  below?: React.ReactElement | null;
  /** below 가 있으면 제목이 부제 역할이라 폰트를 눌러야 한다. */
  titleScale?: number;
  /**
   * 골드 강조줄 인덱스 override. -1 이면 제목에 골드가 없다.
   * ⚠️ below 에 골드를 쓸 때는 반드시 -1 을 넘길 것 — §1.4 는 골드 한 곳만 허용한다.
   */
  accent?: number;
}

export function BrandCard({
  lines,
  frame,
  height,
  bar: barColorHex,
  below = null,
  titleScale = 1,
  accent,
}: BrandCardOpts): React.ReactElement {
  const h = height ?? frame;
  const safeLines = (Array.isArray(lines) && lines.length ? lines : ['카더라']).slice(0, 3);
  const acc = accent === undefined ? accentIndex(safeLines) : accent;
  const pad = frame * 0.055;

  // §1.5 브랜드는 «짧은 변» 기준으로 잡는다. frame(가로) 을 그대로 쓰면 1200×630 에서
  // KADEORA 가 48px 이 돼 630 정사각(25px)과 크기가 어긋나고 세로도 잡아먹는다.
  const shortSide = Math.min(frame, h);
  const bar = barHeight(frame, h);
  const brandRow = shortSide * 0.040 * 1.2 + shortSide * 0.045;

  /**
   * §1.3 은 byHeight 를 frame × 0.84 로 잡는다. 정사각에서는 띠(2.6%)+브랜드 줄을 빼고도
   * 남지만, 1200×630 처럼 가로가 길면 byWidth 가 커져 byHeight 가 그대로 채택되고
   * 84% × lineHeight 1.05 = 88% 가 실제 여백을 넘겨 «제목이 KADEORA 를 덮는다»
   * (실측: og-calc '취득세 계산기'). 그래서 실제 제목 상자를 넘지 않게 눌러 잡는다.
   * ⚠️ min 이라 §1.3 값보다 커지지 않는다 — 630 정사각 검증표는 그대로 유지된다.
   */
  const titleBox = Math.max(1, h - bar - brandRow);
  const fs = Math.min(
    fitFontSize(safeLines, frame, h),
    titleBox / (safeLines.length * 1.05),
  ) * titleScale;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...brandSurface(),
      }}
    >
      {/* 1) 카테고리 띠 */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: bar,
          background: barColorHex,
          flexShrink: 0,
        }}
      />

      {/* 2) 제목 — 정중앙 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: pad,
          paddingRight: pad,
        }}
      >
        {safeLines.map((line, i) => (
          <div
            key={i}
            style={{
              ...titleLineStyle(fs, i === acc),
              justifyContent: 'center',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {line}
          </div>
        ))}
        {below}
      </div>

      {/* 3) 브랜드 */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'center',
          paddingBottom: shortSide * 0.045,
          flexShrink: 0,
        }}
      >
        <div style={brandStyle(shortSide)}>{BRAND_WORDMARK}</div>
      </div>
    </div>
  );
}
