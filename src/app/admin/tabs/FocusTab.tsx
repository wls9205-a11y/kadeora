'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const f=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'K':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const pct=(a:number,b:number)=>b>0?Math.round(a/b*100):0;
const ago=(d:string)=>{const s=Math.floor((Date.now()-new Date(d).getTime())/1000);return s<60?'방금':s<3600?Math.floor(s/60)+'분':s<86400?Math.floor(s/3600)+'시':Math.floor(s/86400)+'일';};

export default function FocusTab({onNavigate}:{onNavigate:(t:any)=>void}) {
  const [d,setD]=useState<any>(null);
  const [ld,setLd]=useState(true);
  const [god,setGod]=useState(false);
  const ref=useRef<any>(null);
  const load=useCallback(()=>{fetch('/api/admin/v2?tab=focus').then(r=>r.json()).then(v=>{setD(v);setLd(false);}).catch(()=>setLd(false));},[]);
  useEffect(()=>{load();ref.current=setInterval(load,30000);return()=>clearInterval(ref.current);},[load]);
  const runGod=async()=>{if(!confirm('전체 크론 실행?'))return;setGod(true);try{await fetch('/api/admin/god-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'all'})});load();}catch{}setGod(false);};

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.3)',fontSize:12}}>불러오는 중...</div>;
  if(!d)return<div style={{textAlign:'center',padding:80}}>⚠️ 로드 실패</div>;

  const{healthScore:hs=0,kpi:k={} as any,growth:g={} as any,extended:x={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],categoryStats:cs=[]}=d;
  const sc=hs>=71?'#10B981':hs>=41?'#F59E0B':'#EF4444';
  const fcn=Object.keys(fc||{}).length;
  const cr=pct(k.cronSuccess,k.cronSuccess+k.cronFail);
  const ctr=k.conversions>0||g.ctaViews7d>0?((g.ctaClicks7d||0)/Math.max(g.ctaViews7d||1,1)*100).toFixed(1):'0';
  const nr=pct(g.notifRead7d||0,g.notifTotal7d||1);
  const mx=dt?.length>0?Math.max(...dt.slice(-14).map((v:any)=>v.pv||0),1):1;

  const warns:string[]=[];
  if((g.profileRate??0)===0&&k.users>0)warns.push('프로필 0%');
  if((k.pushSubs??0)+(k.emailSubs??0)===0)warns.push('구독 0명');
  if(parseFloat(ctr)<1&&(g.ctaViews7d??0)>10)warns.push(`CTR ${ctr}%`);
  if(fcn>0)warns.push(`크론실패 ${fcn}`);

  const C=({children,style={}}:{children:any;style?:React.CSSProperties})=><div style={{background:'rgba(12,21,40,0.7)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,padding:'8px 10px',marginBottom:5,...style}}>{children}</div>;
  const L=({children}:{children:any})=><div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.35)',marginBottom:4,textTransform:'uppercase' as const,letterSpacing:0.5}}>{children}</div>;
  const R=({l,v,c='rgba(255,255,255,0.5)',s=''}:{l:string;v:any;c?:string;s?:string})=>(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'2px 0',fontSize:10}}>
      <span style={{color:'rgba(255,255,255,0.35)'}}>{l}</span>
      <span style={{display:'flex',alignItems:'center',gap:4}}>
        {s&&<span style={{fontSize:8,color:'rgba(255,255,255,0.2)'}}>{s}</span>}
        <span style={{fontWeight:700,color:c,minWidth:28,textAlign:'right' as const}}>{v}</span>
      </span>
    </div>
  );
  const M=({l,v,c,s=''}:{l:string;v:any;c:string;s?:string})=>(
    <div style={{textAlign:'center',padding:'6px 2px'}}>
      <div style={{fontSize:16,fontWeight:800,color:c,lineHeight:1,letterSpacing:-0.5}}>{v}</div>
      <div style={{fontSize:8,color:'rgba(255,255,255,0.4)',marginTop:2}}>{l}</div>
      {s&&<div style={{fontSize:7,color:'rgba(255,255,255,0.2)'}}>{s}</div>}
    </div>
  );

  return (
    <div>
      {/* 위험 신호 */}
      {warns.length>0&&<div style={{display:'flex',gap:4,marginBottom:6,flexWrap:'wrap'}}>{warns.map((w,i)=><span key={i} style={{fontSize:9,fontWeight:600,color:'#EF4444',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.12)',padding:'2px 8px',borderRadius:12}}>⚠ {w}</span>)}</div>}

      {/* KPI 2행 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:4}}>
        <C><M l="유저" v={k.users} c="#3B7BF6" s={`+${k.newUsers}/7d`}/></C>
        <C><M l="PV/일" v={f(k.pvToday)} c="#06B6D4" s={`${f(x.pv7d||0)}/7d`}/></C>
        <C><M l="블로그" v={f(k.blogs)} c="#8B5CF6" s={`${f(x.hotBlogs||0)}핫`}/></C>
        <C><M l="크론" v={`${cr}%`} c={cr>=95?'#10B981':'#EF4444'} s={`${k.cronFail}실패`}/></C>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginBottom:6}}>
        <C><M l="청약" v={f(k.apts)} c="#10B981" s={`D-7:${x.aptDeadline7||0}`}/></C>
        <C><M l="종목" v={f(k.stocks)} c="#F59E0B" s={`미분양${f(k.unsold)}`}/></C>
        <C><M l="단지" v={f(x.aptSites||0)} c="#14B8A6" s={`관심${k.interests}`}/></C>
        <C><M l="DB" v={`${((k.dbMb||0)/1024).toFixed(1)}G`} c={(k.dbMb||0)<4000?'#10B981':'#F59E0B'} s="/8.4G"/></C>
      </div>

      {/* 3열: 유저 | 콘텐츠 | 리텐션 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5,marginBottom:6}}>
        <C><L>👤 유저</L>
          <R l="온보딩" v={`${g.onboardRate??0}%`} c={(g.onboardRate??0)>70?'#10B981':'#F59E0B'}/>
          <R l="프로필" v={`${g.profileRate??0}%`} c={(g.profileRate??0)>20?'#10B981':'#EF4444'}/>
          <R l="지역" v={`${pct(29,k.users)}%`} c={pct(29,k.users)>50?'#10B981':'#F59E0B'}/>
          <R l="연령" v={`${pct(x.ageCount||0,k.users)}%`} c={pct(x.ageCount||0,k.users)>50?'#10B981':'#F59E0B'}/>
          <R l="시드" v={x.seeds||0} c="rgba(255,255,255,0.2)"/>
        </C>
        <C><L>📝 콘텐츠</L>
          <R l="게시글" v={f(x.totalPosts||0)} s={`+${g.postsToday||0}/d`}/>
          <R l="댓글" v={f(x.totalComments||0)} s={`+${g.commentsToday||0}/d`}/>
          <R l="실유저" v={f(k.activeUsers||0)} c="#3B7BF6"/>
          <R l="블로그/d" v={x.newBlogs24||0}/>
        </C>
        <C><L>🔔 리텐션</L>
          <R l="알림열람" v={`${nr}%`} c={nr>10?'#10B981':'#EF4444'}/>
          <R l="오늘발송" v={x.notifSent24||0} s={`열람${x.notifRead24||0}`}/>
          <R l="푸시" v={k.pushSubs??0} c={(k.pushSubs??0)>0?'#10B981':'#EF4444'}/>
          <R l="이메일" v={k.emailSubs??0} c={(k.emailSubs??0)>0?'#10B981':'#EF4444'}/>
        </C>
      </div>

      {/* 2열: SEO | CTA */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:6}}>
        <C><L>🔍 SEO</L>
          <R l="평균" v={41} c={41>50?'#10B981':'#EF4444'}/>
          <R l="리라이트" v={`${k.rewriteRate}%`} s={f(k.rewritten)}/>
          <R l="핫(50+)" v={f(x.hotBlogs||0)} c="#8B5CF6"/>
          <R l="카테고리" v={5}/>
        </C>
        <C><L>📊 CTA 퍼널</L>
          <div style={{display:'flex',gap:2,marginBottom:4}}>
            {[{v:g.ctaViews7d||0,l:'노출',c:'#3B7BF6'},{v:g.ctaClicks7d||0,l:'클릭',c:'#F59E0B'},{v:k.newUsers||0,l:'가입',c:'#10B981'}].map((z,i)=>(
              <div key={z.l} style={{display:'flex',alignItems:'center',gap:2,flex:1}}>
                {i>0&&<span style={{color:'rgba(255,255,255,0.1)',fontSize:8}}>→</span>}
                <div style={{flex:1,textAlign:'center',padding:'3px 0',background:`${z.c}0D`,borderRadius:4}}>
                  <div style={{fontSize:11,fontWeight:800,color:z.c}}>{z.v}</div>
                  <div style={{fontSize:7,color:'rgba(255,255,255,0.2)'}}>{z.l}</div>
                </div>
              </div>
            ))}
          </div>
          <R l="CTR" v={`${ctr}%`} c={parseFloat(ctr)>2?'#10B981':'#EF4444'}/>
          <R l="오늘" v={x.ctaViews24||0} s={`클릭${x.ctaClicks24||0}`}/>
        </C>
      </div>

      {/* 2열: PV차트 | 효율 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:6}}>
        <C>{dt?.length>0&&<><L>📈 14일 PV</L><div style={{display:'flex',alignItems:'flex-end',gap:2,height:32}}>{dt.slice(-14).map((v:any,i:number)=><div key={i} style={{flex:1,height:Math.max(((v.pv||0)/mx)*28,2),borderRadius:2,background:i===dt.slice(-14).length-1?'#3B7BF6':'rgba(59,123,246,0.2)'}}/>)}</div></>}</C>
        <C><L>📊 효율 (v/p)</L>
          {(cs||[]).slice(0,4).map((c:any)=>(
            <div key={c.category} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 0',fontSize:9}}>
              <span style={{width:36,color:'rgba(255,255,255,0.35)'}}>{c.category}</span>
              <div style={{flex:1,height:3,background:'rgba(255,255,255,0.05)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min((c.efficiency||0)/2,100)}%`,background:(c.efficiency||0)>50?'#10B981':(c.efficiency||0)>10?'#F59E0B':'#EF4444',borderRadius:2}}/></div>
              <span style={{width:24,textAlign:'right' as const,fontWeight:700,color:(c.efficiency||0)>50?'#10B981':'rgba(255,255,255,0.3)',fontSize:9}}>{c.efficiency||0}</span>
            </div>
          ))}
        </C>
      </div>

      {/* 3열: 시스템 | 부동산 | 실패크론 */}
      <div style={{display:'grid',gridTemplateColumns:fcn>0?'1fr 1fr 1fr':'1fr 1fr',gap:5,marginBottom:6}}>
        <C><L>🔧 시스템</L>
          <R l="크론/일" v={k.cronSuccess+k.cronFail} s={`${68}종`}/>
          <R l="성공" v={k.cronSuccess} c="#10B981"/>
          <R l="DB" v={`${((k.dbMb||0)/1024).toFixed(1)}G`} c={(k.dbMb||0)<4000?'#10B981':'#F59E0B'}/>
        </C>
        <C><L>🏠 부동산</L>
          <R l="청약" v={f(k.apts)}/>
          <R l="단지" v={f(x.aptSites||0)}/>
          <R l="D-7마감" v={x.aptDeadline7||0} c={(x.aptDeadline7||0)>0?'#F59E0B':'rgba(255,255,255,0.3)'}/>
          <R l="관심" v={k.interests} c={k.interests>0?'#10B981':'#EF4444'}/>
        </C>
        {fcn>0&&<C style={{borderLeft:'2px solid #EF4444'}}><L>❌ 실패 ({fcn})</L>
          {Object.entries(fc||{}).slice(0,4).map(([n,info]:any)=>(
            <div key={n} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.35)'}}>
              <span>{n.replace(/^(blog-|cron-|apt-|stock-)/,'')}</span>
              <span style={{color:'#EF4444',fontWeight:600}}>{info.count}</span>
            </div>
          ))}
        </C>}
      </div>

      {/* 최근 활동 */}
      <C><L>🕐 최근 활동</L>
        {(ra||[]).slice(0,6).map((a:any,i:number)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 0',borderBottom:i<Math.min(ra.length,6)-1?'1px solid rgba(255,255,255,0.03)':'none',fontSize:9}}>
            <span style={{width:24,color:'rgba(255,255,255,0.2)',flexShrink:0}}>{ago(a.at)}</span>
            <span style={{width:5,height:5,borderRadius:'50%',flexShrink:0,background:a.type==='cron'?(a.status==='success'?'#10B981':'#EF4444'):'#3B7BF6'}}/>
            <span style={{color:'rgba(255,255,255,0.45)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{a.name}</span>
            {a.count>0&&<span style={{color:'rgba(255,255,255,0.2)',fontSize:8}}>{a.count}</span>}
          </div>
        ))}
      </C>

      {/* 네비 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3,marginTop:4}}>
        {([['📈','성장','growth'],['👤','유저','users'],['🔧','크론','ops'],['🗄️','데이터','data'],['⚡','실행','execute']] as const).map(([i,l,t])=>(
          <button key={t} onClick={()=>onNavigate(t)} style={{padding:'6px 0',background:'rgba(12,21,40,0.5)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:6,cursor:'pointer',textAlign:'center',fontSize:8,color:'rgba(255,255,255,0.25)'}}>
            <div style={{fontSize:13,opacity:0.4}}>{i}</div>{l}
          </button>
        ))}
      </div>
    </div>
  );
}
