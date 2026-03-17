import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const AUTHORS = [
  '265d8c3b-bd40-40c1-b7d2-bdde16a88204',
  '6e215791-e908-4651-a951-3d1fd90fa0d1',
  'b9dca4b5-c280-4c5f-8af8-84648723fe23',
  'f761ff84-7a69-4a13-b52e-5192a2bbe1a3',
  'a01c798d-2883-49c7-b3c2-660b3c7ec356',
];

const TEMPLATES = [
  { category: 'stock', title: (d: string) => `${d} 오늘의 주식 카더라 모음`, content: '오늘 증시에서 돌아다니는 소문들 모아봄.\n\n반도체: 외국인 순매수 지속\n2차전지: 테슬라 협의 재개 소문\n바이오: 신약 임상 결과 발표 앞둠\n\n각자 판단. 투자 권유 아님.', hashtags: ['주식카더라', '오늘의주식'] },
  { category: 'apt', title: (d: string) => `${d} 이번주 청약 일정 총정리`, content: '이번 주 청약 일정 정리. 접수 중인 단지 체크하고 가점 예상치 공유. 수도권 물량 집중 주라 경쟁률 높을 예상.\n\n자세한 내용은 청약홈 확인 필수.', hashtags: ['청약일정', '아파트청약'] },
  { category: 'free', title: (d: string) => `${d} 재테크 오늘의 팁`, content: '오늘 재테크 관련 알아두면 좋은 것들.\n\n1. 파킹통장 금리: 토스뱅크 > 카카오뱅크\n2. ISA 비과세 한도 활용\n3. 청약통장 최대한 넣기\n\n꿀팁 있으면 댓글로 공유해주셈', hashtags: ['재테크팁', '투자'] },
];

Deno.serve(async () => {
  const kstDate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/\. /g, '.').replace(/\.$/, '');
  let created = 0;

  for (const t of TEMPLATES) {
    const authorId = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
    const todayStart = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase.from('posts').select('id').eq('category', t.category).gte('created_at', todayStart).limit(1);
    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from('posts').insert({
      author_id: authorId, category: t.category,
      title: t.title(kstDate), content: t.content,
      hashtags: t.hashtags, likes_count: 0,
      view_count: Math.floor(Math.random() * 200 + 50), is_deleted: false,
    });
    if (!error) created++;
  }

  return new Response(JSON.stringify({ success: true, created, date: kstDate }), { headers: { 'Content-Type': 'application/json' } });
});
