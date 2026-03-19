import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// Vercel Cron: */30 * * * * (30분마다)
// CRON_SECRET 헤더 검증
// ANTHROPIC_API_KEY 필요 — 없으면 하드코딩 템플릿 사용

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const CATEGORIES = ['stock', 'apt', 'free', 'local'];
const REGIONS = ['서울', '부산', '경기', '인천', '대구', '광주', '대전', '울산', '세종', '제주', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];

const TEMPLATES = [
  { title: '요즘 부동산 시장 전망 어떻게 보시나요?', content: '최근 금리 동결 이후로 거래량이 소폭 늘고 있다고 하는데, 실거주 입장에서 지금 들어가도 괜찮을지 고민입니다. 특히 수도권 외곽 지역 가격이 많이 빠진 곳이 기회일 수도 있다는 의견도 있는데, 여러분 생각은 어떠신가요?' },
  { title: '오늘 코스피 장 마감 분석', content: '외국인 순매수가 3거래일 연속 이어지고 있네요. 특히 반도체 섹터 중심으로 수급이 좋아지고 있어서 기대됩니다. 다만 환율이 1350원대에서 안정화되지 않으면 추가 상승은 제한적이라는 분석도 있더라고요.' },
  { title: '우리 동네 맛집 하나 소개합니다', content: '최근에 발견한 숨은 맛집인데요, 가성비가 진짜 좋아요. 점심 특선이 8,000원인데 반찬도 푸짐하고 맛도 좋습니다. 직장인들 사이에서 입소문 나기 전에 가보세요!' },
  { title: 'ETF 포트폴리오 어떻게 구성하고 계신가요?', content: 'S&P500 50% + 나스닥100 30% + 국내채권 20%로 분산하고 있는데, 최근 미국 시장이 좀 과열 아닌가 싶어서 리밸런싱을 고민 중입니다. 다른 분들은 어떻게 하고 계신지 궁금해요.' },
  { title: '청약 당첨 후기 공유합니다', content: '드디어 3번째 시도에서 청약에 당첨됐습니다! 가점 52점이었는데 은근 높은 경쟁률에도 운이 좋았나 봅니다. 계약금 준비부터 입주까지 과정을 공유하겠습니다.' },
  { title: '주말에 가볼 만한 곳 추천', content: '날씨도 좋아지고 있어서 주말 나들이 장소를 찾고 있는데요, 최근에 가본 곳 중에 좋았던 곳 있으면 추천 부탁드립니다! 가능하면 대중교통으로 갈 수 있는 곳이면 좋겠어요.' },
  { title: '금리 인하 시점, 언제쯤으로 보시나요?', content: '미국 Fed가 올해 안에 1~2회 인하 전망인데, 한국은행도 따라갈까요? 부동산이나 주식 시장에 미칠 영향이 클 것 같아서 미리 포지션을 잡아두고 싶습니다.' },
  { title: '전세 사기 방지 체크리스트 정리', content: '전세 계약할 때 반드시 확인해야 할 항목들을 정리해봤습니다. 등기부등본 확인, 집주인 신원 확인, 전세보증보험 가입, 공인중개사 확인 등 기본적인 것들 놓치지 마세요.' },
  { category: '부동산', title: '2026년 취득세 개편안 정리', content: '올해부터 바뀌는 취득세 기준 공유합니다.\n\n1주택자는 6억 이하 1%, 6~9억 2%, 9억 초과 3%로 변경됩니다.\n다주택자 중과 기준도 완화됐으니 매수 전 꼭 확인하세요.\n취득세는 잔금일 기준으로 계산되니 타이밍도 중요합니다.' },
  { category: '부동산', title: '청약 가점 계산법 완전 정리 (2026 최신)', content: '청약 가점은 최대 84점입니다.\n\n- 무주택기간: 최대 32점 (15년 이상)\n- 부양가족수: 최대 35점 (6명 이상)\n- 청약통장 가입기간: 최대 17점 (15년 이상)\n\n가점이 낮다면 추첨제 물량이 많은 곳을 노리세요.' },
  { category: '부동산', title: '전세 vs 월세 어떤 게 유리할까요 2026년 기준', content: '금리가 내려오면서 전세 vs 월세 계산이 달라졌습니다.\n\n월세전환율을 계산해보면:\n보증금 1억 차이 = 월세 30~40만원 수준이면 월세가 유리\n\n지금은 금리 하락기라 전세자금대출 부담이 줄어서 전세가 유리한 상황입니다.' },
  { category: '부동산', title: '분양권 전매제한 알고 계신가요', content: '분양권 전매제한 기간이 지역별로 다릅니다.\n\n- 투기과열지구: 소유권 이전 등기 시까지\n- 조정대상지역: 6개월~3년\n- 비규제지역: 제한 없음\n\n매수 전 해당 지역 규제 상태 꼭 확인하세요.' },
  { category: '부동산', title: '양도소득세 비과세 요건 정리', content: '1세대 1주택 양도세 비과세 요건:\n\n1. 2년 이상 보유 (조정지역은 2년 거주도 필요)\n2. 양도가액 12억 이하\n3. 세대 분리 요건 충족\n\n12억 초과분에 대해서만 과세되니 계산 잘 해보세요.' },
  { category: '부동산', title: '재개발 조합원 입주권 승계 조건', content: '재개발 입주권을 매수할 때 주의할 점입니다.\n\n권리가액이 분양가보다 낮으면 추가분담금이 발생합니다.\n관리처분인가 이후 매수하면 취득세 중과 적용될 수 있어요.\n\n조합원 지위 승계 가능 여부를 먼저 확인하세요.' },
  { category: '주식', title: '개인투자자 양도세 폐지 논의 현황', content: '금투세 폐지 이후 주식 양도세 논의가 계속되고 있습니다.\n\n현재 대주주 기준 10억 초과 보유 시 과세\n연간 250만원 기본공제 적용\n\n세금 최적화를 위해 연말 손실 확정 매매를 고려해보세요.' },
  { category: '자유', title: '종합소득세 신고 이것만 알면 됩니다', content: '5월은 종합소득세 신고 기간입니다.\n\n신고 대상: 근로소득 외 수입 연 2000만원 초과자\n금융소득종합과세: 이자+배당 합계 2000만원 초과 시\n\n홈택스에서 셀프 신고 가능하니 먼저 미리채움 서비스 확인해보세요.' },
  { category: '부동산', title: '임대사업자 등록 장단점 정리', content: '임대사업자 등록 시 장점:\n- 취득세, 재산세 감면\n- 종부세 합산 배제\n\n단점:\n- 의무임대기간 내 매각 제한\n- 임대료 인상 5% 상한\n\n장기 보유 목적이라면 등록이 유리할 수 있습니다.' },
  { category: '부동산', title: 'DSR 규제 완화 소식 + 대출 한도 계산법', content: '2026년 DSR 규제 현황:\n\n은행권: 총 부채 원리금 상환액 / 연소득 = 40% 이하\n2금융권: 50% 이하\n\n예) 연소득 6000만원이면 연간 원리금 2400만원 = 월 200만원 한도\n소득 증빙 서류 준비가 대출 성패를 가릅니다.' },
  { category: '부동산', title: '미분양 아파트 매수 전 체크리스트', content: '미분양 매수 전 반드시 확인할 것들:\n\n1. 미분양 원인 분석 (가격? 입지? 브랜드?)\n2. 시행사/시공사 재무 상태\n3. 계약금/중도금 일정\n4. 전매 제한 여부\n5. 주변 공급 물량\n\n할인 조건도 꼭 협의해보세요.' },
  { category: '부동산', title: '2026 공시지가 변동과 보유세 영향', content: '올해 공시지가가 전년 대비 평균 5.4% 상승했습니다.\n\n보유세에 직접 영향:\n- 종부세: 공시가격 합산 기준\n- 재산세: 공시가격 × 공정시장가액비율\n\n내 집 공시지가는 부동산공시가격알리미에서 확인하세요.' },
  { category: '주식', title: 'ETF 투자 세금 완전 정리', content: 'ETF 세금 구조:\n\n국내 주식형 ETF: 매매차익 비과세 (배당소득세 15.4%)\n해외 ETF: 매매차익 250만원 초과분 22% 양도세\n채권형 ETF: 분배금 15.4%\n\nISA 계좌 활용 시 일정 비율 비과세 혜택 있습니다.' },
  { category: '자유', title: '연금저축 vs IRP 어디에 더 넣을까', content: '연간 세액공제 한도:\n- 연금저축: 600만원\n- IRP: 900만원 (연금저축 포함)\n\n세액공제율: 총급여 5500만원 이하 16.5%, 초과 13.2%\n\n900만원 가득 채우면 최대 148.5만원 절세 가능합니다.' },
  { category: '부동산', title: '갭투자 지금 해도 될까 현실 분석', content: '갭투자의 현실:\n\n전세가율 70% 이상인 지역은 역전세 위험이 높습니다.\n금리 하락기엔 갭이 줄어드는 경향이 있어요.\n\n현재 시장은 실수요 중심이라 갭투자보다 직접거주 목적 매수가 안전합니다.' },
];

export async function GET(req: NextRequest) {
  // Vercel Cron 인증: CRON_SECRET 환경변수 → Authorization: Bearer 헤더 자동 전송
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRETT].filter(Boolean);
  if (secrets.length === 0 || !secrets.includes(auth || '')) {
    console.error('[seed-posts] Unauthorized:', req.headers.get('x-forwarded-for'));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 시드 유저가 DB에 존재하는지 확인 (UUID에 LIKE 사용 불가 → filter로 text cast)
    const { data: seedCheck } = await admin.from('profiles').select('id').filter('id::text', 'like', 'aaaaaaaa%').limit(1);
    if (!seedCheck || seedCheck.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'No seed users in DB' });
    }

    const userId = SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const regionId = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];

    // ANTHROPIC_API_KEY 있으면 Claude로 생성, 없으면 템플릿 사용
    let title = template.title;
    let content = template.content;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            messages: [{ role: 'user', content: `한국 커뮤니티 앱 "카더라"에 올릴 자연스러운 게시글을 써주세요. 카테고리: ${category}. 지역: ${regionId}. 중요: post의 title, category, region에 맞는 내용만 작성하세요. stock→주식/투자 관련, apt→부동산/아파트/전세/청약 관련, local→해당 지역(${regionId}) 이야기, free→자유로운 일상/생활 주제. 카테고리와 무관한 내용은 절대 쓰지 마세요. 줄바꿈은 \\n 텍스트가 아닌 실제 줄바꿈 문자를 사용하세요. JSON으로 응답: {"title":"제목(30자이내)","content":"내용(200자이내)"}. JSON만 출력하세요.` }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title && parsed.content) {
              title = parsed.title;
              content = parsed.content.replace(/\\n/g, '\n');
            }
          }
        }
      } catch {}
    }

    // 템플릿에 category가 있으면 사용, 없으면 랜덤 카테고리
    const finalCategory = template.category || category;
    const finalRegion = finalCategory === 'local' ? regionId : 'all';

    const { error } = await admin.from('posts').insert({
      author_id: userId,
      title,
      content,
      category: finalCategory,
      region_id: finalRegion,
      is_anonymous: false,
    });

    if (error) {
      console.error('[seed-posts] Failed:', error.message, { title, userId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log('[seed-posts] Created:', title, 'by', userId, 'category:', finalCategory);
    try { revalidatePath('/feed'); revalidatePath('/hot'); } catch {}
    return NextResponse.json({ ok: true, title, category: finalCategory, region: finalRegion });
  } catch (e: any) {
    console.error('[seed-posts] Exception:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
