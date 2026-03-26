import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SEED_TOPICS = [
  // 주식 10
  { title: '삼성전자, 지금 매수 타이밍?', category: 'stock', option_a: '매수', option_b: '관망', is_hot: true },
  { title: '코스피 3000 돌파, 추가 상승 여력 있나?', category: 'stock', option_a: '추가 상승', option_b: '조정 온다', is_hot: true },
  { title: '2차전지 아직 살만할까?', category: 'stock', option_a: '더 오른다', option_b: '고점이다' },
  { title: '미국 빅테크 vs 국내 반도체, 어디에 투자?', category: 'stock', option_a: '미국 빅테크', option_b: '국내 반도체' },
  { title: 'ETF vs 개별 종목, 초보자에게 뭐가 나을까?', category: 'stock', option_a: 'ETF', option_b: '개별 종목' },
  { title: '배당주 vs 성장주, 2026년엔?', category: 'stock', option_a: '배당주', option_b: '성장주' },
  { title: 'AI 반도체 테마, 아직 유효한가?', category: 'stock', option_a: '유효하다', option_b: '끝났다', is_hot: true },
  { title: '공매도 재개, 개인에게 유리? 불리?', category: 'stock', option_a: '유리', option_b: '불리' },
  { title: '코인 투자 vs 주식 투자, 더 나은 선택?', category: 'stock', option_a: '코인', option_b: '주식' },
  { title: '올해 IPO 대어, 청약할 만한가?', category: 'stock', option_a: '무조건 청약', option_b: '스킵' },
  // 부동산 10
  { title: '서울 아파트, 지금 사도 될까?', category: 'apt', option_a: '사야 한다', option_b: '기다리자', is_hot: true },
  { title: '전세 vs 월세, 2026년엔 뭐가 유리?', category: 'apt', option_a: '전세', option_b: '월세' },
  { title: '강남 재건축 vs 마용성 신축, 투자 어디?', category: 'apt', option_a: '강남 재건축', option_b: '마용성 신축' },
  { title: '3기 신도시 입주 시작, 서울 집값 영향?', category: 'apt', option_a: '하락 요인', option_b: '영향 없다' },
  { title: '청약 가점제 vs 추첨제, 어디에 집중?', category: 'apt', option_a: '가점제', option_b: '추첨제' },
  { title: 'GTX 개통, 수혜 지역 집값 오를까?', category: 'apt', option_a: '급등한다', option_b: '이미 반영됨' },
  { title: '갭투자, 2026년에도 유효한 전략?', category: 'apt', option_a: '아직 유효', option_b: '위험하다' },
  { title: '오피스텔 투자, 할만한가?', category: 'apt', option_a: '수익성 있다', option_b: '비추' },
  { title: '다주택자 세금 폭탄, 팔아야 하나?', category: 'apt', option_a: '팔자', option_b: '버티자' },
  { title: '전세 사기 걱정, 매매로 가는게 나을까?', category: 'apt', option_a: '매매가 안전', option_b: '보증보험이면 OK' },
  // 경제·자유 10
  { title: '2026년 한국 경제 전망, 낙관 vs 비관?', category: 'economy', option_a: '낙관', option_b: '비관', is_hot: true },
  { title: '금리 인하, 올해 안에 올까?', category: 'economy', option_a: '온다', option_b: '안 온다' },
  { title: '달러 환율 1400원대, 더 오를까?', category: 'economy', option_a: '더 오른다', option_b: '내린다' },
  { title: '사회초년생 첫 투자, 주식 vs 적금?', category: 'free', option_a: '주식', option_b: '적금' },
  { title: '부업 vs 본업 집중, 돈 버는 데 뭐가 나을까?', category: 'free', option_a: '부업 병행', option_b: '본업 집중' },
  { title: '은퇴 준비, 40대에 시작해도 늦지 않다?', category: 'free', option_a: '충분하다', option_b: '좀 늦다' },
  { title: '보험 리모델링, 해야 할까 말아야 할까?', category: 'free', option_a: '반드시 해야', option_b: '굳이 안 해도' },
  { title: '재테크 유튜버 추천, 믿어도 될까?', category: 'free', option_a: '참고할 만하다', option_b: '조심해야 한다' },
  { title: '금 투자 vs 비트코인, 안전자산은?', category: 'economy', option_a: '금', option_b: '비트코인' },
  { title: '연금저축 vs ISA, 뭐부터 시작?', category: 'free', option_a: '연금저축', option_b: 'ISA' },
];

export async function POST() {
  try {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const admin = getSupabaseAdmin();

  let created = 0;
  for (const topic of SEED_TOPICS) {
    const { data: exists } = await admin.from('discussion_topics').select('id').eq('title', topic.title).maybeSingle();
    if (exists) continue;

    const voteA = Math.floor(Math.random() * 41) + 10;
    const voteB = Math.floor(Math.random() * 41) + 10;

    const { data, error } = await admin.from('discussion_topics').insert({
      ...topic,
      topic_type: 'poll',
      vote_a: voteA,
      vote_b: voteB,
      view_count: Math.floor(Math.random() * 200) + 50,
      comment_count: 0,
      is_pinned: topic.is_hot || false,
    }).select('id').single();

    if (error) { console.error('[seed-discussions]', error.message); continue; }
    created++;
  }

  return NextResponse.json({ ok: true, created, total: SEED_TOPICS.length });
} catch (e: unknown) {
    console.error('[admin] POST', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
