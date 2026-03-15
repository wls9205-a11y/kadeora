import{NextRequest,NextResponse}from'next/server'
import{createSupabaseServer}from'@/lib/supabase-server'
import{rateLimit,getIp,rateLimitResponse,RATE_LIMITS}from'@/lib/rate-limit'
import{sanitizeText}from'@/lib/sanitize'
export async function GET(request:NextRequest){
  const ip=getIp(request)
  const rl=rateLimit('search:'+ip,RATE_LIMITS.search)
  if(!rl.success) return rateLimitResponse(rl)
  const{searchParams}=new URL(request.url)
  const q=sanitizeText(searchParams.get('q')??'').slice(0,100)
  if(!q) return NextResponse.json([])
  const supabase=await createSupabaseServer()
  const{data,error}=await supabase.from('posts').select('id,title,category,created_at,likes_count,comments_count,profiles!posts_author_id_fkey(nickname)').eq('is_deleted',false).or('title.ilike.%'+q+'%,content.ilike.%'+q+'%').order('created_at',{ascending:false}).limit(20)
  if(error) return NextResponse.json({error:'검색에 실패했습니다.'},{status:500})
  supabase.from('search_logs').insert({keyword:q}).then(()=>{})
  return NextResponse.json(data??[])
}