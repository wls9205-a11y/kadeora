export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { withCronLogging } from '@/lib/cron-logger';

const CATEGORIES = ['stock', 'apt', 'free', 'local'];
const REGIONS = ['서울','부산','경기','인천','대구','광주','대전','울산','세종','제주','강원','충북','충남','전북','전남','경북','경남'];

const TEMPLATES = [
  { title: '요즘 부동산 시장 전망 어떻게 보시나요?', content: '최근 금리 동결 이후로 거래량이 소폭 늘고 있다고 하는데, 실거주 입장에서 지금 들어가도 괜찮을지 고민입니다. 특히 수도권 외곽 지역 가격이 많이 빠진 곳이 기회일 수도 있다는 의견도 있는데, 여러분 생각은 어떠신가요?' },
  { title: '오늘 코스피 장 마감 분석', content: '외국인 순매수가 3거래일 연속 이어지고 있네요. 특히 반도체 섹터 중심으로 수급이 좋아지고 있어서 기대됩니다. 다만 환율이 1350원대에서 안정화되지 않으면 추가 상승은 제한적이라는 분석도 있더라고요.' },
  { title: '우리 동네 맛집 하나 소개합니다', content: '최근에 발견한 숨은 맛집인데요, 가성비가 진짜 좋아요. 점심 특선이 8,000원인데 반찬도 푸짐하고 맛도 좋습니다. 직장인들 사이에서 입소문 나기 전에 가보세요!' },
  { title: 'ETF 포트폴리오 어떻게 구성하고 계신가요?', content: 'S&P500 50% + 나스닥100 30% + 국내채권 20%로 분산하고 있는데, 최근 미국 시장이 좀 과열 아닌가 싶어서 리밸런싱을 고민 중입니다. 다른 분들은 어떻게 하고 계신지 궁금해요.' },
  { title: '청약 당첨 후기 공유합니다', content: '드디어 3번째 시도에서 청약에 당첨됐습니다! 가점 52점이었는데 은근 높은 경쟁률에도 운이 좋았나 봅니다. 계약금 준비부터 입주까지 과정을 공유하겠습니다.' },
  { title: '금리 인하 시점, 언제쯤으로 보시나요?', content: '미국 Fed가 올해 안에 1~2회 인하 전망인데, 한국은행도 따라갈까요? 부동산이나 주식 시장에 미칠 영향이 클 것 같아서 미리 포지션을 잡아두고 싶습니다.' },
  { title: '전세 사기 방지 체크리스트 정리', content: '전세 계약할 때 반드시 확인해야 할 항목들을 정리해봤습니다. 등기부등본 확인, 집주인 신원 확인, 전세보증보험 가입, 공인중개사 확인 등 기본적인 것들 놓치지 마세요.' },
  { category: 'apt', title: '2026년 취득세 개편안 정리', content: '올해부터 바뀌는 취득세 기준 공유합니다.\n\n1주택자는 6억 이하 1%, 6~9억 2%, 9억 초과 3%로 변경됩니다.\n다주택자 중과 기준도 완화됐으니 매수 전 꼭 확인하세요.' },
  { category: 'apt', title: '청약 가점 계산법 완전 정리', content: '청약 가점은 최대 84점입니다.\n\n- 무주택기간: 최대 32점\n- 부양가족수: 최대 35점\n- 청약통장 가입기간: 최대 17점\n\n가점이 낮다면 추첨제 물량이 많은 곳을 노리세요.' },
  { category: 'stock', title: '개인투자자 양도세 폐지 논의 현황', content: '금투세 폐지 이후 주식 양도세 논의가 계속되고 있습니다. 현재 대주주 기준 10억 초과 보유 시 과세됩니다. 세금 최적화를 위해 연말 손실 확정 매매를 고려해보세요.' },
  { category: 'apt', title: '갭투자 지금 해도 될까 현실 분석', content: '갭투자의 현실: 전세가율 70% 이상인 지역은 역전세 위험이 높습니다. 금리 하락기엔 갭이 줄어드는 경향이 있어요. 현재 시장은 실수요 중심이라 직접거주 목적 매수가 안전합니다.' },
  { category: 'free', title: '종합소득세 신고 이것만 알면 됩니다', content: '5월은 종합소득세 신고 기간입니다. 신고 대상: 근로소득 외 수입 연 2000만원 초과자. 홈택스에서 셀프 신고 가능하니 먼저 미리채움 서비스 확인해보세요.' },
  { category: 'stock', title: 'ETF 투자 세금 완전 정리', content: '국내 주식형 ETF: 매매차익 비과세 (배당소득세 15.4%)\n해외 ETF: 매매차익 250만원 초과분 22% 양도세\n채권형 ETF: 분배금 15.4%\n\nISA 계좌 활용 시 비과세 혜택 있습니다.' },
  { category: 'apt', title: '미분양 아파트 매수 전 체크리스트', content: '미분양 매수 전 반드시 확인할 것들:\n1. 미분양 원인 분석\n2. 시행사/시공사 재무 상태\n3. 계약금/중도금 일정\n4. 전매 제한 여부\n5. 주변 공급 물량' },
  { category: 'free', title: '연금저축 vs IRP 어디에 더 넣을까', content: '연간 세액공제 한도: 연금저축 600만원, IRP 900만원(연금저축 포함). 세액공제율: 총급여 5500만원 이하 16.5%, 초과 13.2%. 900만원 가득 채우면 최대 148.5만원 절세 가능합니다.' },
];

const COMMENT_TEMPLATES = [
  'ㄹㅇ 공감합니다', '오 정보 감사합니다ㅎㅎ', '저도 알아보는 중이에요', '와 이거 대박이다',
  'ㅋㅋ 맞아요 진짜', '근데 요즘 다들 이렇게 하나요?', '저도 해봐야겠다', '정보 감사요~',
  '이거 진짜 유용하네요', '북마크 해둡니다ㅎㅎ', '공감 백배입니다', '좋은 정보 감사해요!',
  '오 이거 처음 알았어요', '댓글 달고 갑니다~', '저만 이런 줄 알았는데 아니었네ㅋㅋ',
  '헐 나도 이거 봤는데', '진짜요?? 대박', '저도 같은 생각이에요', '참고하겠습니다!',
];

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('seed-posts', async () => {
    const admin = getSupabaseAdmin();

    const { data: seedUsers } = await admin.rpc('get_seed_users');
    if (!seedUsers || seedUsers.length === 0) {
      return { processed: 0, created: 0, failed: 0 };
    }

    // 1~3개 글 랜덤 생성
    const postCount = randInt(1, 3);
    const results: { title: string; comments: number; likes: number }[] = [];

    for (let i = 0; i < postCount; i++) {
      const userId = pick(seedUsers).id;
      const category = pick(CATEGORIES);
      const regionId = pick(REGIONS);

      let title = '', content = '', attempts = 0;
      let selectedTemplate;
      do {
        selectedTemplate = pick(TEMPLATES);
        title = selectedTemplate.title;
        content = selectedTemplate.content;

        // Haiku 생성 시도
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001', max_tokens: 300,
                messages: [{ role: 'user', content: `한국 커뮤니티 앱 "카더라"에 올릴 자연스러운 게시글. 카테고리: ${category}. 지역: ${regionId}. stock→주식, apt→부동산, local→${regionId} 이야기, free→일상. 줄바꿈은 실제 줄바꿈 사용. JSON만: {"title":"제목(30자이내)","content":"내용(200자이내)"}` }],
              }),
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = await res.json();
              const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
              if (match) {
                const parsed = JSON.parse(match[0]);
                if (parsed.title && parsed.content) { title = parsed.title; content = parsed.content.replace(/\\n/g, '\n'); }
              }
            }
          } catch {}
        }

        // Check for duplicate title in last 24h
        const { data: dup } = await admin.from('posts')
          .select('id')
          .eq('title', title)
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
          .limit(1);
        if (!dup || dup.length === 0) break; // unique title, proceed
        attempts++;
      } while (attempts < 3);

      if (attempts >= 3) continue; // skip if all attempts produced duplicates

      const finalCategory = (selectedTemplate as any).category || category;
      const finalRegion = finalCategory === 'local' ? regionId : 'all';

      // 게시글 created_at에 0~25분 랜덤 오프셋
      const offsetMinutes = randInt(0, 25);
      const postCreatedAt = new Date(Date.now() - offsetMinutes * 60000).toISOString();

      // slug 생성
      const slugBase = title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase();

      const { data: postData, error: postError } = await admin.from('posts').insert({
        author_id: userId,
        title, content,
        category: finalCategory,
        region_id: finalRegion,
        is_anonymous: false,
        created_at: postCreatedAt,
      }).select('id').single();

      if (postError || !postData) continue;
      const postId = postData.id;

      // slug 업데이트 (id 필요)
      await admin.from('posts').update({ slug: `${slugBase}-${postId}` }).eq('id', postId);

      // 시드 댓글 0~4개
      const commentCount = randInt(0, 4);
      if (commentCount > 0) {
        const commentUsers = pickN(seedUsers, commentCount);
        const commentRows = commentUsers.map((u: any) => ({
          post_id: postId,
          author_id: u.id,
          content: pick(COMMENT_TEMPLATES),
          comment_type: 'comment',
          created_at: new Date(new Date(postCreatedAt).getTime() + randInt(5, 120) * 60000).toISOString(),
        }));
        await admin.from('comments').insert(commentRows);
        await admin.from('posts').update({ comments_count: commentCount }).eq('id', postId);
      }

      // 시드 좋아요 0~8개
      const likeCount = randInt(0, 8);
      if (likeCount > 0) {
        const likeUsers = pickN(seedUsers, Math.min(likeCount, seedUsers.length));
        const likeRows = likeUsers.map((u: any) => ({
          post_id: postId,
          user_id: u.id,
        }));
        await admin.from('post_likes').insert(likeRows).then(() => {});
        await admin.from('posts').update({ likes_count: likeCount }).eq('id', postId);
      }

      results.push({ title, comments: commentCount, likes: likeCount });
    }

    try { revalidatePath('/feed'); revalidatePath('/hot'); } catch {}
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
    fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cronSecret, path: '/feed' }),
    }).catch(() => {});

    return {
      processed: postCount,
      created: results.length,
      failed: postCount - results.length,
      metadata: { posts: results },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
