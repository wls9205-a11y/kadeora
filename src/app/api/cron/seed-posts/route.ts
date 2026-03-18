import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: */30 * * * * (30분마다)
// CRON_SECRET 헤더 검증
// ANTHROPIC_API_KEY 필요 — 없으면 하드코딩 템플릿 사용

const SEED_USERS = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const CATEGORIES = ['stock', 'apt', 'free', 'local'];
const REGIONS = ['서울', '부산', '인천', '경기', '대구', '광주', '대전', '울산', '제주'];

const TEMPLATES = [
  { title: '요즘 부동산 시장 전망 어떻게 보시나요?', content: '최근 금리 동결 이후로 거래량이 소폭 늘고 있다고 하는데, 실거주 입장에서 지금 들어가도 괜찮을지 고민입니다. 특히 수도권 외곽 지역 가격이 많이 빠진 곳이 기회일 수도 있다는 의견도 있는데, 여러분 생각은 어떠신가요?' },
  { title: '오늘 코스피 장 마감 분석', content: '외국인 순매수가 3거래일 연속 이어지고 있네요. 특히 반도체 섹터 중심으로 수급이 좋아지고 있어서 기대됩니다. 다만 환율이 1350원대에서 안정화되지 않으면 추가 상승은 제한적이라는 분석도 있더라고요.' },
  { title: '우리 동네 맛집 하나 소개합니다', content: '최근에 발견한 숨은 맛집인데요, 가성비가 진짜 좋아요. 점심 특선이 8,000원인데 반찬도 푸짐하고 맛도 좋습니다. 직장인들 사이에서 입소문 나기 전에 가보세요!' },
  { title: 'ETF 포트폴리오 어떻게 구성하고 계신가요?', content: 'S&P500 50% + 나스닥100 30% + 국내채권 20%로 분산하고 있는데, 최근 미국 시장이 좀 과열 아닌가 싶어서 리밸런싱을 고민 중입니다. 다른 분들은 어떻게 하고 계신지 궁금해요.' },
  { title: '청약 당첨 후기 공유합니다', content: '드디어 3번째 시도에서 청약에 당첨됐습니다! 가점 52점이었는데 은근 높은 경쟁률에도 운이 좋았나 봅니다. 계약금 준비부터 입주까지 과정을 공유하겠습니다.' },
  { title: '주말에 가볼 만한 곳 추천', content: '날씨도 좋아지고 있어서 주말 나들이 장소를 찾고 있는데요, 최근에 가본 곳 중에 좋았던 곳 있으면 추천 부탁드립니다! 가능하면 대중교통으로 갈 수 있는 곳이면 좋겠어요.' },
  { title: '금리 인하 시점, 언제쯤으로 보시나요?', content: '미국 Fed가 올해 안에 1~2회 인하 전망인데, 한국은행도 따라갈까요? 부동산이나 주식 시장에 미칠 영향이 클 것 같아서 미리 포지션을 잡아두고 싶습니다.' },
  { title: '전세 사기 방지 체크리스트 정리', content: '전세 계약할 때 반드시 확인해야 할 항목들을 정리해봤습니다. 등기부등본 확인, 집주인 신원 확인, 전세보증보험 가입, 공인중개사 확인 등 기본적인 것들 놓치지 마세요.' },
];

export async function GET(req: NextRequest) {
  // CRON_SECRET 검증
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
            messages: [{ role: 'user', content: `한국 커뮤니티 앱 "카더라"에 올릴 자연스러운 게시글을 써주세요. 카테고리: ${category}. 지역: ${regionId}. JSON으로 응답: {"title":"제목(30자이내)","content":"내용(200자이내)"}. JSON만 출력하세요.` }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title && parsed.content) { title = parsed.title; content = parsed.content; }
          }
        }
      } catch {}
    }

    const { error } = await admin.from('posts').insert({
      author_id: userId,
      title,
      content,
      category,
      region_id: category === 'local' ? regionId : 'all',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, title, category, region: regionId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
