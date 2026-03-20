import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SEED_USERS = Array.from({ length: 89 }, (_, i) => {
  const n = String(i + 1).padStart(4, '0');
  return `aaaaaaaa-${n}-${n}-${n}-${String(i + 1).padStart(12, '0')}`;
});

const CHAT_TEMPLATES = [
  '오늘 장 어때요?', '부산 청약 결과 나왔나요ㅋㅋ', '저 드디어 청약 당첨됐어요!!',
  '진짜요? 부럽다ㅠ', '어디 단지요??', '오늘 삼전 좀 오르네', '코스피 반등 올까요',
  '요즘 부동산 분위기 어때요', 'ETF 추천 있나요?', '적금 금리 어디가 좋나요',
  'ㅋㅋㅋ 오늘도 손실', '월급 들어오자마자 주식으로ㅋ', '전세 계약 갱신 고민중',
  '다음 달 청약 뭐 나오는지 아시는 분?', '금리 인하 언제쯤이려나',
  '요즘 부동산 유튜버 추천해주세요', '오늘 점심 뭐 드셨어요?', '퇴근하고 싶다...',
  '카더라 앱 좋네요ㅎㅎ', '주말에 뭐하세요?',
];

export async function GET(req: NextRequest) {
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRETT].filter(Boolean);
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secrets.length === 0 || !secrets.includes(token || '')) {
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
