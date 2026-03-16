'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createSupabaseBrowser as createClient } from '@/lib/supabase-browser';
import { useHaptic } from '@/hooks/useHaptic';

interface Message { id: number; author_id: string; content: string; created_at: string; is_anonymous: boolean; is_mine?: boolean; profiles?: {username:string;avatar_url?:string}|null; }
interface RoomInfo { id: number; room_type: string; room_key: string; display_name: string; description: string; messages_count: number; source_ref?: string; }
interface StockInfo { symbol: string; name: string; price: number; change_pct: number; market: string; }
interface AptInfo { id: number; house_nm: string; region_nm: string; rcept_bgnde: string; rcept_endde: string; tot_supply_hshld_co: number; }

export default function DiscussionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomType = params?.type as string;
  const roomKey  = params?.roomKey as string;
  const [room, setRoom] = useState<RoomInfo|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(1);
  const [stockInfo, setStockInfo] = useState<StockInfo|null>(null);
  const [aptInfo, setAptInfo] = useState<AptInfo|null>(null);
  const [currentUser, setCurrentUser] = useState<{id:string;username:string}|null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { haptic, hapticSuccess } = useHaptic();
  const scrollToBottom = useCallback(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      if (session?.user) {
        supabase.from('profiles').select('username').eq('id',session.user.id).single()
          .then(({data}) => setCurrentUser({id:session.user.id, username:data?.username ?? '익명'}));
      }
    });
  }, []);

  useEffect(() => {
    if (!roomType || !roomKey) return;
    const load = async () => {
      const {data:rd} = await supabase.from('discussion_rooms').select('*').eq('room_type',roomType).eq('room_key',roomKey).single();
      if (rd) setRoom(rd);
      if (roomType === 'stock') {
        const {data} = await supabase.from('stock_quotes').select('symbol,name,price,change_pct,market').eq('symbol',roomKey.toUpperCase()).single();
        if (data) setStockInfo(data);
      } else if (roomType === 'apt') {
        const {data} = await supabase.from('apt_subscriptions').select('id,house_nm,region_nm,rcept_bgnde,rcept_endde,tot_supply_hshld_co').eq('id',roomKey).single();
        if (data) setAptInfo(data);
      }
    };
    load();
  }, [roomType, roomKey]);

  useEffect(() => {
    if (!room) return;
    setIsLoading(true);
    supabase.from('discussion_messages')
      .select('id,author_id,content,created_at,is_anonymous,profiles(username,avatar_url)')
      .eq('room_id',room.id).eq('is_deleted',false)
      .order('created_at',{ascending:true}).limit(100)
      .then(({data}) => {
        if (data) { setMessages(data.map((m: Record<string, unknown>)=>({...m,is_mine:(m as { author_id?: string }).author_id===currentUser?.id}))); setTimeout(scrollToBottom,100); }
        setIsLoading(false);
      });
  }, [room, currentUser]);

  useEffect(() => {
    if (!room) return;
    const ch = supabase.channel(`room-${room.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'discussion_messages',filter:`room_id=eq.${room.id}`},
        async (payload) => {
          const m = payload.new as Record<string, unknown>;
          const {data:p} = await supabase.from('profiles').select('username,avatar_url').eq('id',m.author_id).single();
          setMessages(prev=>[...prev,{id:m.id,author_id:m.author_id,content:m.content,created_at:m.created_at,is_anonymous:m.is_anonymous,profiles:p,is_mine:m.author_id===currentUser?.id}]);
          setTimeout(scrollToBottom,50);
          if (m.author_id !== currentUser?.id) haptic();
        })
      .on('presence',{event:'sync'},()=>setOnlineCount(Object.keys(ch.presenceState()).length))
      .subscribe(async(s)=>{ if(s==='SUBSCRIBED'&&currentUser) await ch.track({user_id:currentUser.id}); });
    return ()=>{ supabase.removeChannel(ch); };
  }, [room, currentUser]);

  const sendMessage = useCallback(async()=>{
    if(!input.trim()||!currentUser||!room) return;
    hapticSuccess();
    const c=input.trim(); setInput('');
    const {error}=await supabase.from('discussion_messages').insert({room_id:room.id,author_id:currentUser.id,content:c,is_anonymous:isAnon});
    if(error) setInput(c);
  },[input,currentUser,room,isAnon]);

  const fmtTime=(iso:string)=>new Date(iso).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  const displayName=room?.display_name??`${roomKey} ${roomType==='stock'?'토론방':'현장토론방'}`;
  const changeColor=stockInfo?(stockInfo.change_pct>0?'var(--stock-up)':stockInfo.change_pct<0?'var(--stock-down)':'var(--text-tertiary)'):'var(--text-tertiary)';

  return (
    <div className="flex flex-col" style={{backgroundColor:'var(--bg-base)', height:'100dvh'}}>
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b px-4 py-3" style={{backgroundColor:'var(--nav-bg)',borderColor:'var(--border)'}}>
        <div className="flex items-center gap-3">
          <button onClick={()=>{haptic();router.back();}} aria-label="뒤로가기" style={{color:'var(--text-secondary)',background:'none',border:'none',cursor:'pointer',padding:4}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-base truncate" style={{color:'var(--text-primary)'}}>{displayName}</h1>
              {stockInfo&&<span className="font-semibold text-sm" style={{color:changeColor}}>{stockInfo.price.toLocaleString()}원 ({stockInfo.change_pct>0?'+':''}{stockInfo.change_pct?.toFixed(2)}%)</span>}
            </div>
            <p className="text-xs" style={{color:'var(--text-tertiary)'}}>{room?.description} · 🟢 {onlineCount}명 접속 중</p>
          </div>
        </div>
        {aptInfo&&(
          <div className="mt-2 pt-2 border-t flex gap-4 text-xs overflow-x-auto" style={{borderColor:'var(--border)'}}>
            <span style={{color:'var(--text-tertiary)'}}>공급 <strong style={{color:'var(--text-primary)'}}>{aptInfo.tot_supply_hshld_co?.toLocaleString()}세대</strong></span>
            {aptInfo.rcept_bgnde&&<span style={{color:'var(--text-tertiary)'}}>접수 <strong style={{color:'var(--text-primary)'}}>{aptInfo.rcept_bgnde}~{aptInfo.rcept_endde}</strong></span>}
          </div>
        )}
      </header>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {isLoading?(
          <div className="space-y-4">{[...Array(5)].map((_,i)=>(<div key={i} className={`flex gap-2 ${i%2?'flex-row-reverse':''}`}><div className="skeleton w-7 h-7 rounded-full shrink-0"/><div className="skeleton h-10 w-44 rounded-2xl"/></div>))}</div>
        ):messages.length===0?(
          <div className="flex flex-col items-center justify-center h-full text-center py-20 gap-3">
            <span className="text-4xl">{roomType==='stock'?'📈':'🏠'}</span>
            <p className="font-semibold" style={{color:'var(--text-secondary)'}}>아직 대화가 없습니다</p>
            <p className="text-sm" style={{color:'var(--text-tertiary)'}}>{roomType==='stock'?'종목에 대한 의견을 나눠보세요!':'현장 방문기, 주변 시세를 공유해보세요!'}</p>
          </div>
        ):messages.map(msg=>{
          const username=msg.is_anonymous?'익명':(msg.profiles?.username??'?');
          return (
            <div key={msg.id} className={`flex gap-2 items-end animate-fade-in ${msg.is_mine?'flex-row-reverse':''}`}>
              {!msg.is_mine&&<div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{backgroundColor:roomType==='stock'?'var(--brand)':'var(--success)',color:'#fff'}}>{username[0]}</div>}
              <div className={`flex flex-col gap-0.5 max-w-[76%] ${msg.is_mine?'items-end':'items-start'}`}>
                {!msg.is_mine&&<span className="text-xs px-1" style={{color:'var(--text-tertiary)'}}>{username}</span>}
                <div className="px-3 py-2 text-sm leading-relaxed break-words" style={msg.is_mine?{backgroundColor:'var(--brand)',color:'#fff',borderRadius:'16px 16px 4px 16px'}:{backgroundColor:'var(--bg-hover)',color:'var(--text-primary)',borderRadius:'16px 16px 16px 4px'}}>{msg.content}</div>
                <span className="text-xs px-1" style={{color:'var(--text-tertiary)'}}>{fmtTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>

      {/* 입력창 */}
      <div className="border-t px-3 py-2" style={{backgroundColor:'var(--bg-elevated)',borderColor:'var(--border)',paddingBottom:'calc(0.5rem + env(safe-area-inset-bottom,0px))'}}>
        {!currentUser?(
          <div className="text-center py-2">
            <button onClick={()=>{haptic();router.push('/login');}} className="btn-primary text-sm px-6">로그인 후 참여하기</button>
          </div>
        ):(
          <>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={()=>{haptic();setIsAnon(v=>!v);}} className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1"
                style={{backgroundColor:isAnon?'var(--brand-light)':'var(--bg-hover)',color:isAnon?'var(--brand)':'var(--text-tertiary)',border:`1px solid ${isAnon?'var(--brand)':'var(--border)'}`}}>
                {isAnon?'👤 익명 ON':'👥 익명'}
              </button>
            </div>
            <div className="flex gap-2 items-end rounded-2xl border px-3 py-2" style={{borderColor:'var(--border-strong)',backgroundColor:'var(--bg-sunken)'}}>
              <textarea value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                placeholder={roomType==='stock'?`${stockInfo?.name??roomKey}에 대한 의견...`:'현장 정보나 의견을 공유해보세요...'}
                rows={1} className="flex-1 bg-transparent resize-none outline-none text-sm"
                style={{color:'var(--text-primary)',minHeight:24,maxHeight:100}}/>
              <button onClick={sendMessage} disabled={!input.trim()}
                aria-label="메시지 전송"
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all"
                style={{backgroundColor:input.trim()?'var(--brand)':'var(--bg-active)',color:input.trim()?'#fff':'var(--text-tertiary)',transform:input.trim()?'scale(1)':'scale(0.9)'}}>
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
