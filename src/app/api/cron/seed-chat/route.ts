import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const CHAT_TEMPLATES = [
  '오늘 더샵 프리엘라 청약 넣으신 분 있어요?',
  '해운대 신규 분양 경쟁률 어떻게 나왔나요',
  '전세 vs 월세 요즘 뭐가 낫나요 진짜 모르겠어요',
  '강남 아파트 지금 바닥인가요 아니면 더 빠지나요',
  '청약통장 10년 됐는데 가점이 너무 낮아서 걱정이에요',
  '부산 에코델타 요즘 분위기 어때요?',
  '전세사기 요즘도 많나요? 계약 전에 확인할 것들 알려주세요',
  '분당 재건축 기대해도 되는 건가요',
  '서울 빌라 사면 진짜 안 되는 건가요?',
  '금리 인하되면 집값 또 오를까요?',
  '삼성전자 지금 들어가도 될까요?',
  'ETF 적립식으로 매달 얼마씩 넣으세요?',
  '코인 아직도 하시는 분 있어요?',
  'IRP랑 연금저축 둘 다 해야 하나요',
  '달러 환율 너무 높은 것 같은데 지금 사도 되나요',
  '배당주 추천해주실 분 있어요',
  '요즘 미장 vs 국장 어디에 투자하세요?',
  '퇴직금 어떻게 굴리는 게 제일 나을까요',
  '테슬라 존버 계속 해야 하나요 ㅠ',
  'ISA 계좌 만들면 어디에 담는 게 좋아요?',
  '오늘 장 너무 변동성 크지 않나요',
  '다들 월급 저축 얼마나 하세요?',
  '내집 마련 언제쯤 가능할 것 같아요?',
  '재테크 처음 시작하면 뭐부터 해야 하나요',
  '무지출 챌린지 해보신 분 있어요?',
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: seedUsers } = await admin.rpc('get_seed_users');
    const userId = seedUsers?.[Math.floor(Math.random() * (seedUsers?.length || 1))]?.id
      || SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
    const content = CHAT_TEMPLATES[Math.floor(Math.random() * CHAT_TEMPLATES.length)];

    // Check if chat_messages table exists, create if not
    const { error } = await admin.from('chat_messages').insert({ user_id: userId, content });

    if (error) {
      // Table might not exist yet
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ skipped: true, reason: 'chat_messages table not found' });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error' }, { status: 500 });
  }
}
