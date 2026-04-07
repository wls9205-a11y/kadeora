'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const f = (n:number)=>n>=10000?(n/1000).toFixed(0)+'K':n>=1000?(n/1000).toFixed(1)+'K':String(n);
const ago = (d:string)=>{const s=Math.floor((Date.now()-new Date(d).getTime())/1000);return s<60?'방금':s<3600?Math.floor(s/60)+'분':s<86400?Math.floor(s/3600)+'시':Math.floor(s/86400)+'일'};

export default function FocusTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  const [god, setGod] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval>|null>(null);

  const load = useCallback(()=>{
    fetch('/api/admin/v2?tab=focus').then(r=>r.json()).then(v=>{setD(v);setLd(false);}).catch(()=>setLd(false));
  },[]);

  useEffect(()=>{load();ref.current=setInterval(load,30000);return()=>{if(ref.current)clearInterval(ref.current);};},[load]);

  const runGod=async()=>{if(!confirm('전체 크론 실행?'))return;setGod(true);try{await fetch('/api/admin/god-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'all'})});load();}catch{}setGod(false);};

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.3)',fontSize:13}}>불러오는 중...</div>;
  if(!d)return<div style={{textAlign:'center',padding:80,fontSize:13}}>⚠️ 로드 실패</div>;

  const {healthScore:hs=0,kpi:k={} as any,growth:g={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],categoryStats:cs=[]}=d;
  const sc=hs>=71?'#10B981':hs>=41?'#F59E0B':'#EF4444';
  const fcn=Object.keys(fc||{}).length;
  const cr=(k.cronSuccess+k.cronFail)>0?Math.round(k.cronSuccess/(k.cronSuccess+k.cronFail)*100):100;

  const warns:string[]=[];
  if(k.returnRate===0&&k.users>0)warns.push('활동률 0%');
  if((g.notifReadRate??0)===0&&(g.notifTotal7d??0)>50)warns.push('알림 열람 0%');
  if(fcn>0)warns.push(`크론실패 ${fcn}`);
  if((g.ctaCtr??0)<1&&(g.ctaViews7d??0)>10)warns.push(`CTR ${g.ctaCtr}%`);
  if((k.pushSubs??0)+(k.emailSubs??0)===0)warns.push('구독 0명');

  const P=({l,v,c,s}:{l:string;v:any;c:string;s:string})=>(
    <div className="ac" style={{textAlign:'center',padding:'8px 4px'}}>
      <div style={{fontSize:20,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
      <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',marginTop:3}}>{l}</div>
      <div style={{fontSize:8,color:'rgba(255,255,255,0.25)'}}>{s}</div>
    </div>
  );

  const Bar=({l,v,p,c}:{l:string;v:string;p:number;c:string})=>(
    <div style={{marginBottom:5}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
        <span style={{color:'rgba(255,255,255,0.4)'}}>{l}</span>
        <span style={{fontWeight:700,color:c}}>{v}</span>
      </div>
      <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.04)'}}>
        <div style={{height:'100%',width:`${Math.max(p,1)}%`,background:c,borderRadius:2,transition:'width .5s'}}/>
      </div>
    </div>
  );

  return (
    <div>
      {/* ── 헬스 + GOD MODE ── */}
      <div style={{display:'flex',gap:6,marginBottom:6}}>
        <div className="ac" style={{flex:1,display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:`conic-gradient(${sc} ${hs*3.6}deg, rgba(255,255,255,0.05) 0deg)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:34,height:34,borderRadius:'50%',background:'#0C1528',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:900,color:sc}}>{hs}</div>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>{hs>=71?'정상':hs>=41?'주의':'위험'}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>시스템 건강도</div>
          </div>
        </div>
        <button onClick={runGod} disabled={god} style={{width:64,cursor:god?'wait':'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.12))',border:'1px solid rgba(245,158,11,0.15)',borderRadius:10,fontSize:10,fontWeight:700,color:'#F59E0B'}}>
          <span style={{fontSize:20}}>⚡</span>
          {god?'...':'실행'}
        </button>
      </div>

      {/* ── 위험 신호 ── */}
      {warns.length>0&&(
        <div className="ac" style={{padding:'6px 10px',borderLeft:'3px solid #EF4444',display:'flex',flexWrap:'wrap',gap:6}}>
          {warns.map((w,i)=><span key={i} style={{fontSize:10,color:'#EF4444',background:'rgba(239,68,68,0.08)',padding:'2px 8px',borderRadius:20,fontWeight:600}}>{w}</span>)}
        </div>
      )}

      {/* ── KPI 그리드 ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,marginBottom:6}}>
        <P l="유저" v={k.users} c="#3B7BF6" s={`+${k.newUsers}/7d`}/>
        <P l="PV" v={f(k.pvToday)} c="#06B6D4" s="오늘"/>
        <P l="블로그" v={f(k.blogs)} c="#8B5CF6" s={`RW${k.rewriteRate}%`}/>
        <P l="청약" v={f(k.apts)} c="#10B981" s={`관심${k.interests}`}/>
        <P l="종목" v={f(k.stocks)} c="#F59E0B" s={`미분양${f(k.unsold)}`}/>
        <P l="크론" v={`${cr}%`} c={cr>=95?'#10B981':'#EF4444'} s={`${k.cronFail}실패`}/>
      </div>

      {/* ── 성장 2열 ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
        <div className="ac">
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.7)',marginBottom:6}}>유저 건강도</div>
          <Bar l="활동률" v={`${k.returnRate}%`} p={k.returnRate} c={k.returnRate>10?'#10B981':'#EF4444'}/>
          <Bar l="프로필" v={`${g.profileRate??0}%`} p={g.profileRate??0} c={(g.profileRate??0)>20?'#10B981':'#EF4444'}/>
          <Bar l="온보딩" v={`${g.onboardRate??0}%`} p={g.onboardRate??0} c={(g.onboardRate??0)>50?'#10B981':'#F59E0B'}/>
        </div>
        <div className="ac">
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.7)',marginBottom:6}}>리텐션</div>
          {[{l:'알림열람',v:`${g.notifReadRate??0}%`},{l:'푸시',v:`${k.pushSubs??0}`},{l:'이메일',v:`${k.emailSubs??0}`}].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',fontSize:10}}>
              <span style={{color:'rgba(255,255,255,0.35)'}}>{r.l}</span>
              <span style={{fontWeight:600,color:r.v==='0'||r.v==='0%'?'#EF4444':'#10B981'}}>{r.v}</span>
            </div>
          ))}
          {/* CTA 퍼널 */}
          <div style={{display:'flex',gap:2,marginTop:6}}>
            {[{v:g.ctaViews7d??0,l:'노출',c:'#3B7BF6'},{v:g.ctaClicks7d??0,l:'클릭',c:'#F59E0B'},{v:k.newUsers??0,l:'가입',c:'#10B981'}].map((x,i)=>(
              <div key={x.l} style={{flex:1,textAlign:'center',padding:'3px 0',background:`${x.c}0A`,borderRadius:4}}>
                <div style={{fontSize:12,fontWeight:800,color:x.c}}>{x.v}</div>
                <div style={{fontSize:7,color:'rgba(255,255,255,0.3)'}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 14일 PV ── */}
      {dt?.length>0&&(
        <div className="ac" style={{padding:'8px 10px'}}>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:4}}>14일 PV 추이</div>
          <div style={{display:'flex',alignItems:'flex-end',gap:2,height:32}}>
            {dt.slice(-14).map((v:any,i:number)=>{
              const mx=Math.max(...dt.slice(-14).map((x:any)=>x.pv||0),1);
              const h=Math.max(((v.pv||0)/mx)*28,2);
              const last=i===dt.slice(-14).length-1;
              return<div key={i} style={{flex:1,height:h,background:last?'#3B7BF6':'rgba(59,123,246,0.2)',borderRadius:1.5}} title={`${v.date}: ${v.pv}`}/>;
            })}
          </div>
        </div>
      )}

      {/* ── 시스템 + 실패크론 ── */}
      <div style={{display:'grid',gridTemplateColumns:fcn>0?'1fr 1fr':'1fr',gap:6,marginBottom:6}}>
        <div className="ac">
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:4}}>시스템</div>
          {[{l:'크론',p:cr,c:cr>=95?'#10B981':'#F59E0B',r:`${k.cronSuccess}/${k.cronSuccess+k.cronFail}`},{l:'DB',p:Math.round((k.dbMb||0)/8400*100),c:(k.dbMb||0)<4000?'#10B981':'#F59E0B',r:`${f(k.dbMb)}MB`}].map(s=>(
            <div key={s.l} style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.3)',width:20}}>{s.l}</span>
              <div style={{flex:1,height:4,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',width:`${s.p}%`,background:s.c,borderRadius:2}}/></div>
              <span style={{fontSize:8,color:'rgba(255,255,255,0.3)',width:40,textAlign:'right'}}>{s.r}</span>
            </div>
          ))}
        </div>
        {fcn>0&&(
          <div className="ac" style={{borderLeft:'2px solid #EF4444'}}>
            <div style={{fontSize:9,fontWeight:700,color:'#EF4444',marginBottom:3}}>실패 크론 ({fcn})</div>
            {Object.entries(fc||{}).slice(0,4).map(([n,info]:any)=>(
              <div key={n} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.35)'}}>
                <span>{n.replace(/^(blog-|cron-|apt-|stock-)/,'')}</span>
                <span style={{color:'#EF4444',fontWeight:600}}>{info.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 카테고리 효율 ── */}
      {cs?.length>0&&(
        <div className="ac" style={{padding:'8px 10px'}}>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:4}}>콘텐츠 효율 (views/post)</div>
          {cs.slice(0,5).map((c:any)=>(
            <div key={c.category} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 0',fontSize:9}}>
              <span style={{width:40,color:'rgba(255,255,255,0.4)'}}>{c.category}</span>
              <div style={{flex:1,height:3,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(c.efficiency,100)}%`,background:c.efficiency>50?'#10B981':c.efficiency>10?'#F59E0B':'#EF4444',borderRadius:2}}/>
              </div>
              <span style={{width:30,textAlign:'right',fontWeight:700,color:c.efficiency>50?'#10B981':'rgba(255,255,255,0.4)'}}>{c.efficiency}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── 최근 활동 ── */}
      <div className="ac">
        <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:4}}>최근 활동</div>
        {(ra||[]).slice(0,6).map((a:any,i:number)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 0',borderBottom:i<Math.min(ra.length,6)-1?'1px solid rgba(255,255,255,0.03)':'none',fontSize:9}}>
            <span style={{width:28,color:'rgba(255,255,255,0.2)',flexShrink:0}}>{ago(a.at)}</span>
            <span style={{width:5,height:5,borderRadius:'50%',background:a.type==='cron'?(a.status==='success'?'#10B981':'#EF4444'):'#3B7BF6',flexShrink:0}}/>
            <span style={{color:'rgba(255,255,255,0.5)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{a.name}</span>
            {a.count>0&&<span style={{color:'rgba(255,255,255,0.2)'}}>{a.count}</span>}
          </div>
        ))}
      </div>

      {/* ── 빠른 이동 ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,marginTop:6}}>
        {([['📈','성장','growth'],['👤','유저','users'],['🔧','크론','ops'],['🗄️','데이터','data']] as const).map(([i,l,t])=>(
          <button key={t} onClick={()=>onNavigate(t)} style={{padding:'6px 0',background:'rgba(12,21,40,0.6)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,cursor:'pointer',textAlign:'center',fontSize:9,color:'rgba(255,255,255,0.3)'}}>
            <div style={{fontSize:14,opacity:0.5}}>{i}</div>{l}
          </button>
        ))}
      </div>
    </div>
  );
}
