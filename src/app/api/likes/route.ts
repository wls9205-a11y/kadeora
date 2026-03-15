import{NextRequest,NextResponse}from'next/server'
import{createClient}from'@/lib/supabase-server'
import{rateLimit,getIp,rateLimitResponse,RATE_LIMITS}from'@/lib/rate-limit'
import{sanitizeId}from'@/lib/sanitize'
export async function POST(request:NextRequest){
  const ip=getIp(request)
  const rl=rateLimit('likes:'+ip,RATE_LIMITS.action)
  if(!rl.success) return rateLimitResponse(rl)
  const supabase=await createClient()
  const{data:{user},error:ae}=await supabase.auth.getUser()
  if(ae||!user) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401})
  let body:Record<string,unknown>
  try{body=await request.json()}catch{return NextResponse.json({error:'잘못된 요청입니다.'},{status:400})}
  const postId=sanitizeId(body.post_id)
  if(!postId) return NextResponse.json({error:'유효하지 않은 게시글 ID입니다.'},{status:400})
  const{data:existing}=await supabase.from('post_likes').select('id').eq('post_id',postId).eq('user_id',user.id).single()
  if(existing){
    await supabase.from('post_likes').delete().eq('post_id',postId).eq('user_id',user.id)
    return NextResponse.json({liked:false})
  }
  await supabase.from('post_likes').insert({post_id:postId,user_id:user.id})
  return NextResponse.json({liked:true})
}