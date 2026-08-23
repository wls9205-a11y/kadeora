// v4-C7 — 목록 좌측 썸네일 (64×64 정사각).
//
// 왜 정사각 64 인가: 위성 사진이 얼룩으로 보이는 건 16:9 로 크게 깔 때고,
// 작은 정사각에서는 '위치의 인상' 만 남아 스캔에 도움이 된다.
//
// ⚠️ 이미지가 없을 때도 같은 64×64 를 차지해야 한다.
//    썸네일 보유율은 지역 편차가 크다 (실측 2026-08-23: 부산 94% · 경기 33%,
//    공공분양은 위성 미보유). 빈 칸을 만들면 행 정렬이 무너져 스캔이 더 나빠진다.
//    그래서 폴백은 '미표시' 가 아니라 같은 크기의 이니셜 블록이다.
//
// ⚠️ 생성 OG 카드를 폴백으로 쓰지 말 것 — 텍스트 카드라 64px 에서 글씨가 안 보인다.
// ⚠️ priority 금지. 목록 이미지가 현장 상세 히어로의 LCP 와 경쟁한다.

const SIZE = 64;

/** 이니셜 블록 배경. 이름 해시로 고정 배정 — 같은 단지는 항상 같은 색이다. */
const TONES = [
  { bg: 'var(--accent-blue-bg)', fg: 'var(--brand)' },
  { bg: 'var(--accent-green-bg)', fg: 'var(--accent-green)' },
  { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)' },
  { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)' },
  { bg: 'var(--accent-red-bg)', fg: 'var(--accent-red)' },
];

function toneOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/**
 * 이니셜 2글자. 괄호 안 부기(공공분양·1블록 등)와 앞뒤 공백을 걷고 앞 2자.
 * 한글은 한 글자가 이미 음절이라 2자면 충분히 구별된다.
 */
function initialsOf(name: string): string {
  const clean = (name || '')
    .replace(/[[(（【].*?[\])）】]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '—';
  return clean.slice(0, 2);
}

export type ListThumbProps = {
  /** 없으면 이니셜 블록. 빈 문자열도 없음으로 취급한다. */
  src?: string | null;
  /** 이니셜 추출 + 색 배정의 시드. 단지명·글 제목·종목명. */
  name: string;
  /** 세로 크기만 다르게 쓰고 싶을 때 (주식은 64×40). 기본은 정사각. */
  height?: number;
};

export default function ListThumb({ src, name, height = SIZE }: ListThumbProps) {
  const url = src || '';
  const tone = toneOf(name);

  return (
    <span
      className="kd-lrow-thumb"
      aria-hidden="true"
      style={{
        width: SIZE,
        height,
        background: url ? 'var(--bg-elevated)' : tone.bg,
      }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          width={SIZE}
          height={height}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-.04em',
            color: tone.fg,
          }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
