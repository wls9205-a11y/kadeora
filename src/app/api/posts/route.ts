import{NextRequest,NextResponse}from'next/server'
import{createSupabaseServer}from'@/lib/supabase-server'
import{rateLimit,getIp,rateLimitResponse,RATE_LIMITS}from'@/lib/rate-limit'
import{sanitizePostInput}from'@/lib/sanitize'
export async function GET(request:NextRequest){
  const supabase=await createSupabaseServer()
  const{searchParams}=new URL(request.url)
  const category=searchParams.get('category')
  const page=Math.max(1,parseInt(searchParams.get('page')??'1'))
  const limit=Math.min(20,parseInt(searchParams.get('limit')??'20'))
  const offset=(page-1)*limit
  let q=supabase.from('posts').select('id,title,category,created_at,view_count,likes_count,comments_count,author_id,profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)').eq('is_deleted',false).order('created_at',{ascending:false}).range(offset,offset+limit-1)
  if(category&&category!=='all') q=q.eq('category',category)
  const{data,error}=await q
  if(error) return NextResponse.json({error:'게시글을 불러올 수 없습니다.'},{status:500})
  return NextResponse.json(data??[])
}
export async function POST(request:NextRequest){
  const ip=getIp(request)
  const rl=rateLimit('posts:'+ip,RATE_LIMITS.write)
  if(!rl.success) return rateLimitResponse(rl)
  const supabase=await createSupabaseServer()
  const{data:{user},error:ae}=await supabase.auth.getUser()
  if(ae||!user) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401})
  let body:Record<string,unknown>
  try{body=await request.json()}catch{return NextResponse.json({error:'잘못된 요청 형식입니다.'},{status:400})}
  const s=sanitizePostInput(body)
  if(!s.title||s.title.length<2) return NextResponse.json({error:'제목은 2자 이상 입력해주세요.'},{status:400})
  if(!s.content||s.content.length<10) return NextResponse.json({error:'내용은 10자 이상 입력해주세요.'},{status:400})
  if(!s.category) return NextResponse.json({error:'올바른 카테고리를 선택해주세요.'},{status:400})
  const{data,error}=await supabase.from('posts').insert({title:s.title,content:s.content,category:s.category,author_id:user.id}).select().single()
  if(error) return NextResponse.json({error:'게시글 작성에 실패했습니다.'},{status:500})
  return NextResponse.json(data,{status:201})
}