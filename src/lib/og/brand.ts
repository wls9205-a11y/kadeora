/**
 * T1 §3.3 — OG 썸네일 공용 브랜드 모듈.
 *
 * 9개 생성기가 같은 상수를 복붙하지 않도록 여기 하나에만 둔다.
 * 배경·골드·카테고리 띠 색을 바꿔야 하면 이 파일만 고친다.
 *
 * ⚠️ satori 제약 (T1 §4) — filter / clip-path / mask / box-shadow 미지원,
 *    이모지 금지, 자식 2개 이상인 div 는 display:'flex' 명시 필수.
 */

/* ── §1.1 배경 ────────────────────────────────────────────────────────────
 * 전 생성기·전 카드 동일. 카테고리·카드번호로 «절대» 분기하지 않는다.
 * satori 는 backgroundImage 에 콤마로 여러 겹을 받는다. CSS 규칙상 앞쪽이 위층이라
 * 광원을 먼저, 베이스 그라디언트를 뒤에 둔다.
 */
/* ⚠️ H5-D1 (2026-08-27) — globals.css 의 --brand-hero-bg / --brand-hero-glow 와 «동기» 다.
 *
 * 왜 두 곳에 있나: OG 썸네일은 satori 가 TS 상수로 그린다. CSS 를 «타지 않는다».
 * 반대로 화면 컴포넌트는 CSS 변수만 쓸 수 있다. 그래서 같은 값이 두 표현으로 존재한다.
 *
 * ⛔ 한쪽만 고치면 OG 카드와 첫 화면 색이 갈린다. 고칠 땐 반드시 양쪽을 같이,
 *    그리고 «바이트 단위로 같게». 대비 실측은 docs/m6/H5_대비실측.md 에 있다.
 *    특히 끝점 #2563EB 위의 골드는 3.27:1 이라 하한 미달이다 — 값을 밝은 쪽으로
 *    옮기지 말 것. */
export const BRAND_BG =
  'linear-gradient(158deg, #0B2A6B 0%, #123A8F 52%, #2563EB 100%)';

export const BRAND_GLOW =
  'radial-gradient(120% 90% at 12% 6%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0) 62%)';

/** backgroundImage 에 그대로 넣는 2겹 문자열 (광원이 위). */
export const BRAND_BG_LAYERS = `${BRAND_GLOW}, ${BRAND_BG}`;

/** 그라디언트가 실패해도 검정이 뜨지 않게 하는 단색 바닥. */
export const BRAND_BG_SOLID = '#0B2A6B';

/** 배경 2겹 + 바닥색을 한 번에 얹는 style 조각. */
export const brandSurface = () => ({
  backgroundColor: BRAND_BG_SOLID,
  backgroundImage: BRAND_BG_LAYERS,
});

/* ── §1.4 골드 ─────────────────────────────────────────────────────────── */
/** 확정 골드. #FAC775 는 폐기됐다 — 되살리지 말 것. */
export const GOLD = '#FFC53D';
export const INK = '#FFFFFF';

/* ── §1.2 상단 카테고리 띠 ─────────────────────────────────────────────
 * 띠가 «유일한» 카테고리 표시다. 배지·pill·아이콘을 따로 두지 않는다 —
 * 제목 자리를 먹는다.
 */
export type CategoryStream =
  | '분양'
  | '재개발·정비'
  | '미분양'
  | '시세·실거래'
  | '가이드·계산기'
  | '주식'
  | '기타';

export const CATEGORY_BAR: Record<CategoryStream, string> = {
  '분양': '#FF8A5B',
  '재개발·정비': '#A78BFA',
  '미분양': '#FBBF6E',
  '시세·실거래': '#34D399',
  '가이드·계산기': '#60A5FA',
  '주식': '#F472B6',
  '기타': '#94A3B8',
};

/** 띠 높이 — frame × 0.026, 최소 2px. 가로 캔버스는 짧은 변을 기준으로 잡는다. */
export function barHeight(frame: number, height: number = frame): number {
  return Math.max(2, Math.round(Math.min(frame, height) * 0.026));
}

export interface StreamInput {
  category?: string | null;
  subCategory?: string | null;
  cronType?: string | null;
  title?: string | null;
}

/**
 * DB 분류(category / sub_category / cron_type)와 제목을 §1.2 계열 7종으로 접는다.
 *
 * ⚠️ apt + sub_category NULL 이 2,485편으로 최대 버킷인데 내용은 정비사업·청약이
 *    섞여 있다(cron_type='district-redev-monthly' 등). 그래서 명시 필드 → cron_type →
 *    제목 키워드 순으로 훑는다. 어떤 입력에도 던지지 않고 '기타' 로 떨어진다.
 */
export function categoryStream(input: StreamInput): CategoryStream {
  try {
    const cat = String(input.category || '').trim().toLowerCase();
    const sub = String(input.subCategory || '').trim().toLowerCase();
    const cron = String(input.cronType || '').trim().toLowerCase();
    const title = String(input.title || '');

    // 1) 최상위 category 가 이미 계열인 경우
    if (cat === 'stock') return '주식';
    if (cat === 'unsold') return '미분양';
    if (cat === 'redev') return '재개발·정비';
    if (cat === 'finance') return '가이드·계산기';

    // 2) sub_category — 한글/영문 키가 섞여 있다
    if (sub) {
      if (/미분양|unsold/.test(sub)) return '미분양';
      if (/재개발|재건축|정비|redevelop/.test(sub)) return '재개발·정비';
      if (/청약|분양|cheongak|lotto|preempt/.test(sub)) return '분양';
      if (/실거래|시세|trade|price/.test(sub)) return '시세·실거래';
    }

    // 3) cron_type
    if (cron) {
      if (/unsold/.test(cron)) return '미분양';
      if (/redev/.test(cron)) return '재개발·정비';
      if (/subscription|cheongak|preempt/.test(cron)) return '분양';
      if (/trade|price/.test(cron)) return '시세·실거래';
      if (/calculator|guide|tax/.test(cron)) return '가이드·계산기';
    }

    // 4) 제목 키워드 — 여기까지 오면 분류가 비어 있는 글이다
    if (/미분양/.test(title)) return '미분양';
    if (/재개발|재건축|정비사업|가로주택|리모델링/.test(title)) return '재개발·정비';
    if (/청약|분양/.test(title)) return '분양';
    if (/실거래|시세|매매가|전세가/.test(title)) return '시세·실거래';
    if (/계산기|가이드/.test(title)) return '가이드·계산기';

    return '기타';
  } catch {
    return '기타';
  }
}

/** 계열 → 띠 색. 알 수 없으면 '기타' 회색. */
export function barColor(input: StreamInput): string {
  return CATEGORY_BAR[categoryStream(input)] ?? CATEGORY_BAR['기타'];
}

/* ── §2 제목 추출 ──────────────────────────────────────────────────────
 * 실제 발행 제목 22건(빈 문자열·null 포함)으로 검증된 코드다. 8,775편 배치용이라
 * 예외가 나와도 «절대 던지지 않고» 폴백한다. 다시 짜지 말 것.
 *
 * 설계 시 밟은 함정 (T1 §2):
 *   1. '-' 를 절단 문자에 넣지 말 것 — 범천1-1, 반여3-1 이 잘린다
 *   2. 지역 접두어를 무조건 떼지 말 것 — 떼고 기능어만 남으면 되돌린다
 *   3. 1글자 어절은 앞에 붙일 것 — '이번 주' → '이번주'
 *   4. 중점은 조각을 버리지 말고 어절로 쪼갤 것
 *   5. fitFontSize 하한 28px
 *   6. 어떤 입력에도 던지지 말 것
 */
const TRAIL = /\s*[（(]?\s*20\d{2}\s*년?\s*\d{0,2}\s*월?\s*\d?\s*주?\s*[)）]?\s*$/;
const CUT = /[—–|:：(\[（]/;                 // '-'는 제외 — 범천1-1, 반여3-1 이 잘린다
const DROP = ['총정리', '완벽 가이드', '가이드', '한눈에', '모아보기', '정리', '분석', '전망',
  '비교', '해석', '최신', '동향', '핫이슈', '체크포인트', '선점', '시장 영향',
  '계약 전', '청약 선점', '급상승',
  // T2: 카더라가 붙인 정형 접미사. '투자 분석' '단지 분석' '시세 현황' '실거래가 리포트'
  // ⚠️ '투자' 는 «뒤에 공백이 올 때만» 뗀다. 맨 '투자' 로 두면 이름 안을 자른다 —
  //    실측: '디디아이엘브이씨위탁관리모부동산투자회사' → '…모부동산' + '회사' 로 갈라져 48px.
  '리포트', '현황', '투자 ', '단지'];

/**
 * T2 — 아파트 브랜드 사전. 띄어쓰기 없는 단지명을 «의미 경계»에서 자르기 위한 것이다.
 *
 * 왜 필요한가: splitLong 이 글자 수 절반에서 기계적으로 잘라 이런 결과가 나왔다.
 *   디엠씨해링턴플레 / 이스엔에이치에프      Lulul / emon
 *   에스아이팰리 / 스강동센텀               울산뉴시티에 / 일린의뜰1차
 * 원인은 정비구역명이 아니라 «띄어쓰기 없는 단지명»이었다.
 * '디엠씨해링턴플레이스엔에이치에프' 가 16자 한 어절이다.
 *
 * ⚠️ 긴 것이 앞에 와야 한다. 순서가 곧 우선순위다 —
 *    '해링턴플레이스' 가 '해링턴' 보다 먼저 잡혀야 한다.
 */
const BRANDS = [
  '해링턴플레이스', '해링턴타워', '에일린의뜰', '더스카이시티', '스카이시티', '리버파크',
  'e편한세상', '이편한세상', '베르디움', '센트레빌', '한신더휴', '스위트엠', '디에트르',
  '아이파크', '롯데캐슬', '더플래티넘', '플래티넘', '포레나', '트리마제', '하이베뉴',
  '힐스테이트', '푸르지오', '래미안', '스위첸', '데시앙', '유보라', '리슈빌', '어울림',
  '코아루', '캐스빌', '하이빌', '노르웨이숲', '대광로제비앙', '로제비앙', '제일풍경채',
  '풍경채', '아너스빌', '한라비발디', '비발디', '서희스타힐스', '스타힐스', '금강펜테리움',
  '내안애', '퍼스트힐', '팰리스', '하이씨티', '더테라스', '스타클래스', '아침도시', '브라운스톤',
  '모아엘가', '모아미래도', '에듀퍼스트', '수자인', '파르세나', '뉴스테이', '르네상스', '메세나폴리스',
  '트리니티', '엘크루', '더퍼스트', '센트럴파크', '에듀포레',
  '펜테리움', '우미린', '린스트라우스', '휴먼시아', '파크리오', '자이르네',
  '더샵', '자이', '위브', '아너스', '부영', '포레', '캐슬', '파크', '시티',
];

// 동·호 나열은 단지명이 아니다. '205동206동207동' '101,102동' 은 통째로 뺀다.
const DONG_RUN = /(\d{1,4}\s*[,~·]?\s*)?(\d{1,4}동\s*){2,}/g;
const DONG_TAIL = /\s*\d{1,4}(\s*[,~·]\s*\d{1,4})*\s*동\s*$/;
const REGION = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|부울경|전국)$/;
// 이 어절만 남으면 무의미 — 앞에서 잘린 결과가 기능어뿐인 경우
const STOP = /^(이번|주|월|년|현장|움직인|곳|등|및|외|그|더|것|수|중)$/;

function clean(s: unknown): string {
  let t = String(s || '').trim().replace(TRAIL, '');
  // T2: 동 나열과 끝의 '아파트' 는 판독에 보태는 게 없다.
  // ⚠️ DONG_RUN 을 CUT 절단보다 먼저 돌린다 — '…205동206동207동 시세' 처럼
  //    나열이 CUT 문자 앞에 있는 경우가 대부분이다.
  t = t.replace(DONG_RUN, ' ').replace(DONG_TAIL, ' ');
  t = t.replace(/아파트(?=\s|$)/g, ' ');
  const m = t.match(CUT);
  if (m && m.index !== undefined && m.index > 1) t = t.slice(0, m.index);
  t = t.replace(TRAIL, '');
  for (const w of DROP) t = t.split(w).join(' ');
  return t
    // ⚠️ 숫자 사이 콤마·소수점을 «살린다». 원안처럼 통째로 공백을 만들면 틀린 수치가
    //    썸네일에 나간다 — 실측: 17.9% → '17' '9' 로 쪼개진 뒤 그 '9' 가 아래 '1글자
    //    어절은 앞에 붙인다' 규칙에 먹혀 '179' 가 됐다. 7,981 → '사상최고7' '981'.
    //    발행 8,747편 중 255편이 이 경로로 깨졌다.
    .replace(/[^0-9A-Za-z가-힣·,.\s\-]/g, ' ')
    // 숫자에 붙지 않은 콤마·소수점은 원안대로 공백 ('GS건설, 2년' 의 콤마 등)
    .replace(/(?<!\d)[,.]|[,.](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * T2 — 긴 한 어절을 «의미 경계»에서 자른다.
 *
 * 이전 구현은 `Math.ceil(w.length/2)` 로 글자 수 절반에서 기계적으로 잘랐다.
 * 그래서 '디엠씨해링턴플레 / 이스엔에이치에프' 같은 결과가 나왔고,
 * T1 보고의 「60px 미만」과 「어절 반토막」은 별개 티켓이 아니라 이 하나가 원인이었다.
 *
 * ⚠️ 정규식 lookbehind zero-width 를 쓰지 말 것. `(?<=[동리])(?=[가-힣]{4,})` 형태가
 *    실제로 무한루프를 냈다. 아래는 인덱스 순회다 — 그대로 둔다.
 * ⚠️ 브랜드를 못 찾고 11자 미만이면 자르지 않는다. 폰트를 줄이는 편이 낫다.
 * ⚠️ 영문을 글자 수로 자르지 않는다. 하이픈·대문자 경계만 — 'Lulul / emon' 전례.
 */
function splitLong(w: string): string[] {
  if (w.length <= 8) return [w];

  // 영문은 의미 경계에서만. 없으면 그대로 둔다.
  if (!/[가-힣]/.test(w)) {
    if (w.length <= 10) return [w];
    const byHyphen = w.split(/[-–—]/).filter(Boolean);
    if (byHyphen.length >= 2) return byHyphen.slice(0, 3);
    // 소문자→대문자 경계에 구분자를 끼워 넣고 그것으로 자른다.
    // ⚠️ 소스에 보이지 않는 제어문자를 직접 박지 않는다 — 포매터·git 필터에 유실되면
    //    split 구분자가 사라져 글자 단위로 쪼개진다.
    const SEP = String.fromCharCode(1);
    const byCase = w.replace(/([a-z])([A-Z])/g, `$1${SEP}$2`).split(SEP);
    if (byCase.length >= 2) return byCase.slice(0, 3);
    return [w];
  }

  // 브랜드 토큰 경계 (긴 것 우선 — BRANDS 순서가 곧 우선순위)
  for (const b of BRANDS) {
    const i = w.indexOf(b);
    if (i < 0) continue;
    const head = w.slice(0, i);
    const tail = w.slice(i + b.length);
    const out: string[] = [];
    if (head.length >= 2) out.push(head);
    out.push(tail.length && tail.length <= 4 ? b + tail : b);
    if (tail.length > 4) out.push(tail);
    if (out.length >= 2) {
      // ⚠️ 브랜드가 «끝»에 붙어 있으면 머리가 통째로 남는다.
      //    실측: '옥정중앙역중흥S-클래스센텀시티' → 머리 13자 + '시티' = 41px.
      //    머리가 아직 길면 한 번 더 가른다.
      if (out[0].length >= 11) {
        const sub = splitByIndex(out[0]);
        if (sub.length >= 2) out.splice(0, 1, ...sub);
      }
      return out.slice(0, 3);
    }
  }

  // 브랜드를 못 찾아도 11자를 넘으면 630 캔버스에서 52px 미만이 되어 읽히지 않는다.
  if (w.length >= 11) {
    const parts = splitByIndex(w);
    if (parts.length >= 2) return parts;
  }
  return [w];   // 의미 없는 지점에서 쪼개느니 폰트를 줄인다
}

/**
 * 브랜드 사전이 못 잡은 긴 어절을 «점수가 가장 높은 한 지점»에서 가른다.
 *
 * ⚠️ 정규식 lookbehind zero-width 를 쓰지 말 것 — `(?<=[동리])(?=[가-힣]{4,})` 형태가
 *    실제로 무한루프를 냈다. 인덱스 순회로 둔다.
 */
function splitByIndex(w: string): string[] {
  if (w.length < 8) return [w];
  const mid = Math.round(w.length / 2);
  const SUF = '동리읍면구시군로가';            // 지역 접미 뒤가 경계일 확률이 높다
  let best = -1;
  let bestScore = -1;
  for (let i = 3; i <= w.length - 3; i++) {
    const prev = w[i - 1];
    const cur = w[i];
    if ('의에애스시제로은는이가을를도만'.includes(cur)) continue;   // 조각이 조사·파편으로 시작
    let score = /[0-9]/.test(cur) && !/[0-9]/.test(prev) ? 3
      : SUF.includes(prev) ? 2 : 1;
    score = score * 10 - Math.abs(i - mid);                        // 중앙에 가까울수록 가산
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best > 0 ? [w.slice(0, best), w.slice(best)] : [w];
}

/**
 * 정비구역 관형 표기를 줄이고 어절 경계를 살린다.
 *
 * 정비구역·지구 이름은 공식 표기가 길어 한 어절이 14자까지 간다.
 * '마포로제1구역제19-1지구' 는 fitFontSize 가 41px 을 내고, 그건 120px 썸네일에서
 * 8px 이라 읽히지 않는다 — T1 의 본래 목적이 판독이므로 여기서 잡는다.
 *
 *   1) 관형 '제' 를 뗀다 — 제1구역 → 1구역. 뒤가 숫자일 때만이라
 *      '제일건설' '제주' 같은 이름은 건드리지 않는다.
 *   2) 구역/지구 뒤에 이름이 «이어붙어» 있으면 어절로 가른다.
 *      '오룡지구한국아델리움' → '오룡지구' '한국아델리움'
 *   3) 끝에 붙은 긴 사업유형(6자 이상)만 따로 뗀다.
 *      '청량리3재정비촉진구역' → '청량리3' '재정비촉진구역'
 *
 * ⚠️ 3)에 맨 '구역'·'지구' 를 넣지 말 것. '범천1-1구역' 이 '범천1-1' + '구역' 으로
 *    갈라져 «구역» 한 줄이 생긴다. 6자 이상 복합어만 대상이다.
 * ⚠️ 이름 자체를 줄이지 않는다. 글자를 버리는 게 아니라 줄을 나누는 것뿐이다.
 */
const REDEV_UNIT = /(재정비촉진구역|재정비촉진지구|도시환경정비구역|도시환경정비지구|주택재개발정비구역|주택재건축정비구역|주택재개발정비지구|주택재건축정비지구|재개발정비구역|재건축정비구역|재개발정비지구|재건축정비지구|소규모재건축|가로주택정비|주거환경개선)$/;

function splitRedevUnit(w: string): string[] {
  const t = w.replace(/제(?=\d)/g, '');                  // 1) 관형 '제'
  const parts = t.replace(/(구역|지구)(?=[0-9A-Za-z가-힣])/g, '$1 ').split(' '); // 2)
  return parts.flatMap((p) => {                          // 3)
    const m = p.match(REDEV_UNIT);
    if (!m) return [p];
    const head = p.slice(0, p.length - m[1].length);
    // 머리가 비었거나 숫자 한 자뿐이면 자르지 않는다. '1주택재개발정비지구' 의 '1' 은
    // 제1의 '1' 이라 떼면 숫자 하나가 한 줄을 차지한다.
    if (/^\d?$/.test(head)) return [p];
    return [head, m[1]];
  }).filter(Boolean);
}

/** 1글자 기능어를 앞 어절에 붙인다: '이번 주' → '이번주'. 구역 분리 뒤에도 다시 돌린다. */
function mergeSingles(words: string[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (w.length <= 1 && out.length) out[out.length - 1] += w;
    else out.push(w);
  }
  return out;
}

/** 블로그 제목 → 썸네일 2~3줄. 4줄 이상 금지, 말줄임표 금지. */
export function titleLines(raw: unknown): string[] {
  try {
    const original = String(raw || '').trim();
    let words = clean(original).split(' ').filter(Boolean);

    words = mergeSingles(words);

    // 지역 접두어 제거 — 어절 4개 이상일 때만. 떼고 나서 기능어만 남으면 되돌린다
    if (words.length >= 4 && REGION.test(words[0])) {
      const rest = words.slice(1);
      if (!rest.every((w) => STOP.test(w))) words = rest;
    }
    // 중점은 어절 경계로 — '진주·봉황아파트' → '진주' '봉황아파트'
    words = words.flatMap((w) => w.split('·')).filter(Boolean);
    // 정비구역 관형 표기 축약 — 14자 한 어절이 폰트를 41px 까지 끌어내린다.
    // 분리가 1글자 조각을 만들 수 있으므로 병합을 한 번 더 돌린다
    words = mergeSingles(words.flatMap(splitRedevUnit).filter(Boolean));

    if (!words.length) return [original.slice(0, 6) || '카더라'];      // 폴백
    if (words.length === 1) return splitLong(words[0]);

    // T2 — 어절이 여럿이어도 «가장 긴 것»이 10자를 넘으면 그것만 쪼개 최장줄을 낮춘다.
    // fitFontSize 는 최장줄 길이로 폰트를 정하므로, 짧은 어절이 몇 개 붙어 있어도
    // 16자짜리 하나가 남아 있으면 48px 까지 떨어진다.
    {
      let li = 0;
      for (let i = 1; i < words.length; i++) if (words[i].length > words[li].length) li = i;
      if (words[li].length >= 10) {
        const parts = splitLong(words[li]);
        if (parts.length >= 2) words = words.slice(0, li).concat(parts, words.slice(li + 1));
      }
    }

    if (words.length === 2) {
      const out = words.flatMap(splitLong);
      return out.slice(0, 3);
    }
    return words.slice(0, 3);
  } catch {
    return ['카더라'];
  }
}

/**
 * §1.3 제목 폰트 — 고정 사다리가 아니라 계산으로 정한다.
 * 한글은 폭≈높이라 글자수로 폭을 근사할 수 있다.
 *
 * height 는 정사각(630)이면 생략한다 — §2 검증표는 2인자 호출 기준이다.
 * 1200×630 처럼 가로가 긴 캔버스만 세 번째 인자를 넘긴다.
 */
export function fitFontSize(lines: string[], frame: number, height: number = frame): number {
  const maxc = Math.max(...lines.map((l) => (l || '').length), 1);
  const usable = frame - frame * 0.055 * 2;
  return Math.max(28, Math.min(usable / maxc * 1.02, height * 0.84 / (lines.length * 1.06)));
}

/** §1.4 골드로 칠할 줄. 3줄이면 가운데, 2줄이면 두 번째, 1줄이면 없음(-1). */
export function accentIndex(lines: string[]): number {
  return lines.length >= 2 ? 1 : -1;
}

/* ── §1.5 브랜드 ───────────────────────────────────────────────────────
 * 하단 중앙 'KADEORA' 만. 로고 사각형·골드 밑줄·도메인·날짜는 전부 제거했다 —
 * 120px 로 축소되면 5px 라 읽히지 않고 자리만 먹는다. 되살리지 말 것.
 */
export const BRAND_WORDMARK = 'KADEORA';

export function brandStyle(frame: number) {
  return {
    display: 'flex' as const,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 700 as const,
    fontSize: frame * 0.040,
    letterSpacing: frame * 0.011,
  };
}

/** §1.3 제목 한 줄 style. accent 가 true 면 골드. */
export function titleLineStyle(fontSize: number, accent: boolean) {
  return {
    display: 'flex' as const,
    fontSize,
    fontWeight: 800 as const,
    lineHeight: 1.05,
    letterSpacing: -fontSize * 0.046,
    color: accent ? GOLD : INK,
    // textShadow 없음 — 축소 시 글자를 뭉갠다 (§1.3, §6.6)
  };
}
