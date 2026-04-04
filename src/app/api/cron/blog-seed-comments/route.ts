import { errMsg } from '@/lib/error-utils';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

// AI 시드 댓글 템플릿 (카테고리별)
const TEMPLATES: Record<string, string[]> = {
 stock: [
 '이 종목 전망이 궁금했는데 도움이 많이 되네요 ',
 '배당 정보까지 정리해주셔서 감사합니다. 참고하겠습니다!',
 '추가로 PER/PBR 비교도 있으면 좋겠어요',
 '이 섹터 전체적으로 좋은 흐름이네요',
 '장기 투자 관점에서 좋은 분석이네요. 감사합니다',
 '실적 발표 후에 업데이트 부탁드려요!',
 ],
 apt: [
 '이 지역 청약 경쟁률이 어떻게 될까요?',
 '분양가가 주변 시세 대비 어떤 수준인지 궁금합니다',
 '교통 개선 호재가 있다고 들었는데 반영되어 있나요?',
 '자세한 분석 감사합니다. 청약 준비에 도움이 되네요!',
 '학군 정보도 추가해주시면 좋겠어요',
 '입주 예정일 기준으로 투자가치가 있을까요?',
 ],
 unsold: [
 '미분양 단지 중에서 가성비 좋은 곳이 있나요?',
 '할인 분양 정보가 있으면 알려주세요!',
 '미분양이 줄어드는 추세인지 궁금합니다',
 '현장 방문 후기도 있으면 좋겠네요',
 ],
 finance: [
 '재테크 초보인데 정리가 잘 되어 있어서 이해가 쉬워요!',
 '세금 부분이 복잡한데 깔끔하게 정리해주셔서 감사합니다',
 '실제 적용해보니 도움이 많이 됐어요 ',
 '추가 팁이 있다면 시리즈로 연재해주세요!',
 ],
};

const NICKNAMES = [
 '재테크초보', '부동산탐험가', '주식고수', '청약준비생', '투자연구소',
 '경제뉴스봇', '월급쟁이투자자', '절약의달인', '배당매니아', '부린이',
 '주린이탈출', '내집마련', '재테크노트', '투자일기', '경제상식',
];

export async function GET(req: Request) {
 const authHeader = req.headers.get('authorization');
 if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 const sb = getSupabaseAdmin();
 let seeded = 0;

 try {
 // 댓글 0건인 최근 블로그 글 50개 가져오기
 const { data: posts } = await sb
 .from('blog_posts')
 .select('id, title, category')
 .eq('is_published', true)
 .order('published_at', { ascending: false })
 .limit(50);

 if (!posts?.length) return NextResponse.json({ seeded: 0 });

 // 이미 댓글이 있는 글 제외
 const { data: existingComments } = await sb
 .from('blog_comments')
 .select('blog_post_id')
 .in('blog_post_id', posts.map(p => p.id));

 const postsWithComments = new Set((existingComments || []).map((c: Record<string, any>) => c.blog_post_id));
 const postsNeedComments = posts.filter(p => !postsWithComments.has(p.id));

 // 각 글에 1~2개 시드 댓글 생성
 for (const post of postsNeedComments.slice(0, 20)) {
 const cat = post.category || 'finance';
 const templates = TEMPLATES[cat] || TEMPLATES.finance;
 const numComments = Math.random() > 0.5 ? 2 : 1;

 for (let i = 0; i < numComments; i++) {
 const comment = templates[Math.floor(Math.random() * templates.length)];
 const nickname = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];

 await sb.from('blog_comments').insert({
 blog_post_id: post.id,
 content: comment,
 author_name: nickname,
 is_seed: true,
 });
 seeded++;
 }
 }

 // 크론 로그
 await sb.from('cron_logs').insert({
 cron_name: 'blog-seed-comments',
 status: 'success',
 records_created: seeded,
 });

 return NextResponse.json({ seeded, checked: postsNeedComments.length });
 } catch (e: unknown) {
 await sb.from('cron_logs').insert({
 cron_name: 'blog-seed-comments',
 status: 'failed',
 error_message: errMsg(e)?.substring(0, 500),
 });
 return NextResponse.json({ error: errMsg(e) }, { status: 200 });
 }
}
