export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const h = (v: number) => ((v * 2654435761 + 0x9e3779b9) >>> 0).toString(16).padStart(8, '0');
  const a = h(i * 7 + 31); const b = h(i * 13 + 47).slice(0, 4); const c = h(i * 19 + 61).slice(0, 4);
  const d = h(i * 23 + 73).slice(0, 4); const e = h(i * 29 + 83).padStart(12, '0').slice(0, 12);
  return `${a}-${b}-4${c.slice(1)}-${['8','9','a','b'][i % 4]}${d.slice(1)}-${e}`;
});

// 게시글 제목 키워드 기반 맞춤 댓글 생성
function generateComment(title: string, category: string): string {
  const t = title.toLowerCase();

  // 주식 관련
  if (category === 'stock' || t.includes('주가') || t.includes('종목') || t.includes('투자')) {
    if (t.includes('삼성') || t.includes('반도체')) return pick(['반도체 사이클 바닥 찍은 거 같은데 의견 어떠신가요?','삼성 주주로서 관심 갖고 봅니다','HBM 수주 소식이 관건일 듯','실적 발표 전에 좀 더 지켜봐야 할 것 같아요']);
    if (t.includes('배당')) return pick(['배당주 포트에 넣을 만한 종목이네요','배당성향이 꾸준한 게 좋네요','배당락 전에 매수 타이밍 잡아야겠다']);
    if (t.includes('etf') || t.includes('ETF')) return pick(['ETF 적립식으로 모아가는 중입니다','분산 투자 효과가 확실히 있더라고요','수수료도 따져봐야 해요']);
    if (t.includes('ai') || t.includes('AI') || t.includes('인공지능')) return pick(['AI 관련주 변동성이 큰 편이라 분할 매수가 나을 듯','테마 과열인 건 아닌지 걱정되네요','장기적으로 성장할 분야인 건 맞는 것 같아요']);
    if (t.includes('실적') || t.includes('어닝')) return pick(['어닝 서프라이즈 나오면 갭 상승 가능성 있죠','컨센서스 대비 얼마나 나올지가 핵심이네요','실적 시즌 전에 미리 준비해야겠어요']);
    return pick(['차트 흐름 보니 관심 가는 종목이네요','이 종목 워치리스트에 추가해둬야겠다','거래량 추이도 같이 봐야 할 것 같아요','수급 데이터 확인해봐야겠네요','PER이 부담스럽지 않은 수준이면 괜찮아 보여요','섹터 전체 흐름이 중요할 듯']);
  }

  // 부동산 관련
  if (category === 'apt' || t.includes('청약') || t.includes('분양') || t.includes('아파트')) {
    if (t.includes('청약')) return pick(['가점 몇 점이면 당첨 가능할까요?','특별공급 조건도 확인해봐야겠네요','경쟁률 높을 것 같은 느낌','무주택 기간이 관건이겠네요','추첨제 물량도 있나요?']);
    if (t.includes('실거래') || t.includes('시세')) return pick(['이 단지 최근 거래 보니 조금 빠진 것 같은데요','전세가율이 꽤 높네요','주변 신축 대비 가격 메리트 있어 보여요','실거래 추이 보면서 판단해야겠어요']);
    if (t.includes('전세') || t.includes('월세')) return pick(['전세 사기 예방 위해 등기부등본 꼭 확인하세요','보증보험 가입 가능한지도 체크해야 해요','월세 전환율 따져보면 전세가 나을 수도']);
    if (t.includes('재개발') || t.includes('재건축')) return pick(['조합원 분담금이 관건이죠','사업 진행 속도가 어떤지 궁금하네요','인허가 단계까지 오래 걸리는 경우가 많더라고요']);
    return pick(['교통 호재 있으면 시세 영향 클 텐데요','학군도 중요한 요소죠','입주 물량 체크 필수입니다','주변 인프라 정보 감사합니다','직접 임장 다녀와야 제대로 알 수 있어요']);
  }

  // 재테크/투자
  if (category === 'finance' || t.includes('재테크') || t.includes('적금') || t.includes('절약')) {
    return pick(['저도 비슷한 방법으로 하고 있어요','소소하게 모으는 게 결국 큰 차이 만들더라고요','가계부 쓰기 시작하니 확실히 달라졌어요','좋은 정보 공유 감사합니다','월급날에 바로 자동이체 걸어두는 게 핵심이죠']);
  }

  // 우리동네/지역
  if (category === 'local' || t.includes('동네') || t.includes('우리')) {
    return pick(['우리 동네도 비슷한 상황이에요','여기 근처 살아서 공감합니다','동네 정보 공유 감사해요','저도 같은 느낌 받았었어요','이 근처 맛집 정보도 궁금해요']);
  }

  // 자유 주제 — 제목 키워드 매칭
  if (t.includes('아침') || t.includes('오늘')) return pick(['좋은 아침이에요! 오늘도 화이팅','아침부터 부지런하시네요','오늘 하루도 잘 보내세요']);
  if (t.includes('시작') || t.includes('다짐')) return pick(['동기부여 되네요! 저도 같이 실천해볼게요','꾸준함이 결국 이기죠','좋은 다짐이네요 응원합니다']);
  if (t.includes('출퇴근') || t.includes('직장')) return pick(['직장인 공감 100%','출퇴근 시간이 아깝다면 그게 시작이에요','퇴근 후 시간 활용이 핵심이죠']);
  if (t.includes('절약') || t.includes('짠테크')) return pick(['티끌 모아 태산이 진짜더라고요','저도 카페 줄이고 텀블러 들고 다녀요','편의점 습관만 바꿔도 월 10만원은 아끼더라고요']);

  return pick(['공감 가는 글이네요','좋은 내용 감사합니다','저도 비슷하게 생각하고 있었어요','참고할 부분이 많네요','관심 있게 보고 갑니다']);
}

function pick(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // 최근 게시글 중 댓글 적은 것 우선
    const { data: posts } = await admin
      .from('posts')
      .select('id, title, category, comments_count')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30);
    if (!posts || posts.length === 0) return NextResponse.json({ skipped: true });

    // 댓글 적은 게시글 우선 선택 (가중치)
    const sorted = [...posts].sort((a, b) => (a.comments_count ?? 0) - (b.comments_count ?? 0));
    const post = sorted[Math.floor(Math.random() * Math.min(10, sorted.length))];

    // 7일 내 동일 게시글 중복 댓글 방지
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count: recentCount } = await admin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .gte('created_at', sevenDaysAgo);
    if ((recentCount ?? 0) >= 3) return NextResponse.json({ skipped: true, reason: 'enough_recent_comments' });

    const { data: seedUsers } = await admin.rpc('get_seed_users');
    const userId = seedUsers?.[Math.floor(Math.random() * (seedUsers?.length || 1))]?.id
      || SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];

    const content = generateComment(post.title || '', post.category || 'free');

    // 30% 확률로 관련 종목/현장 자연스럽게 언급 (자동 링킹 대상)
    let finalContent = content;
    try {
      if (Math.random() < 0.3) {
        if (post.category === 'stock' || (post.title || '').match(/주식|종목|투자|매수|배당/)) {
          const { data: rs } = await admin.from('stock_quotes').select('name, symbol').eq('is_active', true).gt('price', 0).order('volume', { ascending: false, nullsFirst: false }).limit(10);
          if (rs?.length) {
            const s = rs[Math.floor(Math.random() * rs.length)];
            const additions = [
              `\n참고로 ${s.name}도 같이 보고 있어요`,
              `\n${s.name}은 어떻게 보세요?`,
              `\n저는 ${s.name}도 관심 목록에 넣어뒀어요`,
            ];
            finalContent += additions[Math.floor(Math.random() * additions.length)];
          }
        } else if (post.category === 'apt' || (post.title || '').match(/청약|분양|아파트|재개발/)) {
          const { data: ra } = await (admin as any).from('apt_sites').select('name, region').eq('is_active', true).not('analysis_text', 'is', null).order('page_views', { ascending: false, nullsFirst: false }).limit(10);
          if (ra?.length) {
            const a = ra[Math.floor(Math.random() * ra.length)];
            const additions = [
              `\n${a.name}도 관심 있어서 같이 알아보는 중이에요`,
              `\n${a.region} ${a.name}은 어떤지 아시는 분?`,
              `\n저는 ${a.name}도 비교해보고 있어요`,
            ];
            finalContent += additions[Math.floor(Math.random() * additions.length)];
          }
        }
      }
    } catch {}

    const { error } = await admin.from('comments').insert({
      post_id: post.id,
      author_id: userId,
      content: finalContent,
      comment_type: 'comment',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 200 });

    const { count } = await admin.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', post.id);
    await admin.from('posts').update({ comments_count: count ?? 0 }).eq('id', post.id);

    return NextResponse.json({ ok: true, post_id: post.id, title: post.title, comment: content });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 200 });
  }
}
