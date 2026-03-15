import{NextRequest,NextResponse}from'next/server'
import{createSupabaseServer}from'@/lib/supabase-server'
import{createClient as admin}from'@supabase/supabase-js'
export async function DELETE(request:NextRequest){
  const supabase=await createSupabaseServer()
  const{data:{user},error:ae}=await supabase.auth.getUser()
  if(ae||!user) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401})
  let body:{confirm?:string}={}
  try{body=await request.json()}catch{}
  if(body.confirm!=='계정을 삭제합니다') return NextResponse.json({error:'확인 문구가 일치하지 않습니다.'},{status:400})
  const now=new Date().toISOString()
  const{error:pe}=await supabase.from('profiles').update({is_deleted:true,deleted_at:now,nickname:'탈퇴한 사용자',avatar_url:null,bio:null,phone:null,kakao_id:null,google_email:null}).eq('id',user.id)
  if(pe) return NextResponse.json({error:'계정 삭제 중 오류가 발생했습니다.'},{status:500})
  const ac=admin(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await ac.auth.admin.deleteUser(user.id).catch(console.error)
  await supabase.auth.signOut()
  return NextResponse.json({message:'계정이 성공적으로 삭제되었습니다.'})
}