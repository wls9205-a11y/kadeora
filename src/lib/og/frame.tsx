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
}

export function BrandCard({
  lines,
  frame,
  height,
  bar,
  below = null,
  titleScale = 1,
}: BrandCardOpts): React.ReactElement {
  const h = height ?? frame;
  const safeLines = (Array.isArray(lines) && lines.length ? lines : ['카더라']).slice(0, 3);
  const acc = accentIndex(safeLines);
  const fs = fitFontSize(safeLines, frame, h) * titleScale;
  const pad = frame * 0.055;

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
          height: barHeight(frame, h),
          background: bar,
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
          paddingBottom: frame * 0.045,
          flexShrink: 0,
        }}
      >
        <div style={brandStyle(frame)}>{BRAND_WORDMARK}</div>
      </div>
    </div>
  );
}
