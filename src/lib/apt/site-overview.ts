/**
 * AB-1 — 「단지 개요」 정의문 리드 + 개요 불릿 (PQAB E-3 · 2026-09-15).
 *
 * AI 브리핑·음성 검색이 «첫 문단 한 개» 를 인용한다. 그 문단이 «이 단지가 무엇인가» 를
 * 실데이터로 한 번에 말하게 한다. F2 분석문(AI 생성)과 독립이다 — 이 파일은 AI 를 부르지 않는다.
 *
 * ⛔ 모르는 값은 «문장에서 뺀다». 「시공사 미정」「세대수 -」 같은 자리표시를 쓰지 않는다.
 * ⛔ 가격은 호출부가 합성가를 이미 비운 값만 넘긴다(Q-1 격리 승계 — stripSyntheticPrice 이후).
 * ⚠️ 조사: 기존 FAQ 관례대로 「은(는)」 병기. 이름이 영문·숫자로 끝나는 현장이 많아 자동 판정이 틀리는 자리를 만들지 않는다.
 */
import type { ScheduleRow } from '@/lib/apt/schedule';

export interface OverviewInput {
  name: string;
  region?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  builder?: string | null;
  siteType?: string | null;
  /** 한글 단계 라벨(lifecycleLabel 결과). */
  stageLabel?: string | null;
  /** 이미 공고 전·후 규칙을 거친 일정 행(buildSchedule). */
  schedule?: ScheduleRow[];
  units?: number | null;
  maxFloor?: number | null;
  /** 합성가가 비워진 뒤의 표시 문자열(예: 「4.9억~14.6억」). 없으면 null. */
  priceText?: string | null;
  /** 준공·기축 단지인가(입주 후·랜드마크). 「들어서는」 대신 「위치한」. */
  built?: boolean;
}

export interface OverviewBullet { label: string; value: string }
export interface SiteOverview { lead: string | null; bullets: OverviewBullet[] }

const TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '정비사업',
  unsold: '미분양',
  trade: '아파트',
  landmark: '아파트',
};

const clean = (v: string | null | undefined) => (v ?? '').trim();
const pos = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);

/** 국면 한 줄 — 가장 가까운 «현재·다음» 일정 1행. 출처·기준일이 있으면 괄호로 병기한다. */
function phaseOf(rows: ScheduleRow[] | undefined): { text: string; bullet: string } | null {
  const row = (rows ?? []).find((r) => r.state === 'current') ?? (rows ?? []).find((r) => r.state === 'future');
  if (!row || !clean(row.text)) return null;
  const tail = [row.source, row.asof ? `${row.asof} 기준` : null].filter(Boolean).join(' · ');
  const body = `${row.label} ${row.text}`;
  return { text: tail ? `${body}(${tail})` : body, bullet: tail ? `${row.text} (${tail})` : row.text };
}

export function buildSiteOverview(i: OverviewInput): SiteOverview {
  const name = clean(i.name);
  if (!name) return { lead: null, bullets: [] };

  // ⚠️ 접두 겹침으로 거르지 않는다 — 「부산」·「부산진구」는 겹쳐 보여도 다른 층위다.
  const loc = [clean(i.region), clean(i.sigungu), clean(i.dong)].filter(Boolean).join(' ');
  const builder = clean(i.builder);
  const typeLabel = TYPE_LABEL[clean(i.siteType)] ?? '아파트';
  const units = pos(i.units);
  const floor = pos(i.maxFloor);
  const phase = phaseOf(i.schedule);
  const stage = clean(i.stageLabel);

  // ① 정의문 — 위치·시공사가 없어도 문장이 서게 조립한다
  const verb = i.built ? '위치한' : '들어서는';
  const first = `${name}은(는) ${loc ? `${loc}에 ${verb} ` : ''}${builder ? `${builder}의 ` : ''}${typeLabel} 단지입니다.`;
  const scale = [units ? `${units.toLocaleString('ko-KR')}세대` : null, floor ? `최고 ${floor}층` : null].filter(Boolean).join('·');
  let second = '';
  if (scale && phase) second = `${scale} 규모로, ${phase.text}입니다.`;
  else if (scale && stage) second = `${scale} 규모로, 현재 ${stage} 단계입니다.`;
  else if (scale) second = `${scale} 규모입니다.`;
  else if (phase) second = `${phase.text}입니다.`;
  else if (stage) second = `현재 ${stage} 단계입니다.`;
  const lead = second ? `${first} ${second}` : first;

  // ② 개요 불릿 — NULL 은 행째 뺀다
  const bullets: OverviewBullet[] = [];
  if (loc) bullets.push({ label: '위치', value: loc });
  if (scale) bullets.push({ label: '규모', value: scale });
  if (builder) bullets.push({ label: '시공사', value: builder });
  if (stage) bullets.push({ label: '진행 단계', value: stage });
  if (phase) bullets.push({ label: '일정', value: phase.bullet });
  if (clean(i.priceText)) bullets.push({ label: '분양가', value: clean(i.priceText) });
  return { lead, bullets: bullets.slice(0, 6) };
}
