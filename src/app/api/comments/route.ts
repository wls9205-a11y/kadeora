import{NextRequest,NextResponse}from'next/server'
import{createClient}from'@/lib/supabase-server'
import{rateLimit,getIp,rateLimitResponse,RATE_LIMITS}from'@/lib/rate-limit'
import{sanitizeCommentInput,sanitizeId}from'@/lib/sanitize'
export async function GET(request:NextRequest){
  const supabase=await createClient()
  const{searchParams}=new URL(request.url)
  const postId=sanitizeId(searchParams.get('post_id'))
  if(!postId) return NextResponse.json({error:'유효하지 않은 게시글 ID입니다.'},{status:400})
  const{data,error}=await supabase.from('comments').select('id,content,created_at,likes_count,author_id,is_deleted,profiles!comments_author_id_fkey(id,nickname,avatar_url)').eq('post_id',postId).eq('is_deleted',false).order('created_at',{ascending:true}).limit(100)
  if(error) return NextResponse.json({error:'댓글을 불러올 수 없습니다.'},{status:500})
  return NextResponse.json(data??[])
}
export async function POST(request:NextRequest){
  const ip=getIp(request)
  const rl=rateLimit('comments:'+ip,RATE_LIMITS.write)
  if(!rl.success) return rateLimitResponse(rl)
  const supabase=await createClient()
  const{data:{user},error:ae}=await supabase.auth.getUser()
  if(ae||!user) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401})
  let body:Record<string,unknown>
  try{body=await request.json()}catch{return NextResponse.json({error:'잘못된 요청입니다.'},{status:400})}
  const postId=sanitizeId(body.post_id)
  if(!postId) return NextResponse.json({error:'유효하지 않은 게시글 ID입니다.'},{status:400})
  const s=sanitizeCommentInput(body)
  if(!s.content) return NextResponse.json({error:'댓글 내용을 입력해주세요.'},{status:400})
  const{data,error}=await supabase.from('comments').insert({content:s.content,post_id:postId,author_id:user.id}).select().single()
  if(error) return NextResponse.json({error:'댓글 작성에 실패했습니다.'},{status:500})
  return NextResponse.json(data,{status:201})
}