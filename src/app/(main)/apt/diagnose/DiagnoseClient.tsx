'use client';
import { useState } from 'react';
import Link from 'next/link';
import SectionShareButton from '@/components/SectionShareButton';
import { trackFeature } from '@/lib/analytics';

const HT = [
  {min:0,max:1,s:2},{min:1,max:2,s:4},{min:2,max:3,s:6},{min:3,max:4,s:8},{min:4,max:5,s:10},{min:5,max:6,s:12},{min:6,max:7,s:14},{min:7,max:8,s:16},
  {min:8,max:9,s:18},{min:9,max:10,s:20},{min:10,max:11,s:22},{min:11,max:12,s:24},{min:12,max:13,s:26},{min:13,max:14,s:28},{min:14,max:15,s:30},{min:15,max:99,s:32},
];
const BT = [
  {min:0,max:0.5,s:1},{min:0.5,max:1,s:2},{min:1,max:2,s:3},{min:2,max:3,s:4},{min:3,max:4,s:5},{min:4,max:5,s:6},{min:5,max:6,s:7},{min:6,max:7,s:8},
  {min:7,max:8,s:9},{min:8,max:9,s:10},{min:9,max:10,s:11},{min:10,max:11,s:12},{min:11,max:12,s:13},{min:12,max:13,s:14},{min:13,max:14,s:15},{min:14,max:15,s:16},{min:15,max:99,s:17},
];
const CUTS = [
  {r:'서울',avg:62,min:55,max:72},{r:'경기',avg:56,min:48,max:67},{r:'인천',avg:50,min:40,max:60},{r:'세종',avg:52,min:42,max:62},
  {r:'부산',avg:48,min:38,max:58},{r:'대구',avg:45,min:35,max:55},{r:'대전',avg:44,min:34,max:54},{r:'광주',avg:42,min:32,max:52},
  {r:'울산',avg:40,min:30,max:50},{r:'강원',avg:35,min:25,max:45},{r:'충북',avg:36,min:26,max:46},{r:'충남',avg:38,min:28,max:48},
  {r:'전북',avg:34,min:24,max:44},{r:'전남',avg:32,min:22,max:42},{r:'경북',avg:36,min:26,max:46},{r:'경남',avg:38,min:28,max:48},{r:'제주',avg:40,min:30,max:50},
];
function gs(t:{min:number;max:number;s:number}[],y:number){for(const r of t)if(y>=r.min&&y<r.max)return r.s;return t[t.length-1].s;}

export default function DiagnoseClient() {
  const [step,setStep]=useState(0);
  const [age,setAge]=useState(35);
  const [married,setMarried]=useState('yes');
  const [housingYears,setHousingYears]=useState(5);
  const [spouse,setSpouse]=useState(1);
  const [children,setChildren]=useState(1);
  const [parents,setParents]=useState(0);
  const [siblings,setSiblings]=useState(0);
  const [bankYears,setBankYears]=useState(7);
  const [spouseBankYears,setSpouseBankYears]=useState(0);
  const [showResult,setShowResult]=useState(false);

  const canCount=married==='yes'||age>=30;
  const hs=canCount?gs(HT,housingYears):0;
  const fc=(married==='yes'?spouse:0)+children+parents+siblings;
  const fs=Math.min(35,fc*5+5);
  // 배우자 통장 합산: 배우자 통장 50% 인정, 최대 3점, 합산 최대 17점
  const myBank=gs(BT,bankYears);
  const spouseBank=married==='yes'?Math.min(3,Math.floor(gs(BT,spouseBankYears)/2)):0;
  const bs=Math.min(17,myBank+spouseBank);
  const total=hs+fs+bs;
  const pct=Math.round((total/84)*100);

  const grade=total>=55?{l:'매우 높음',c:'var(--accent-green)'}:total>=40?{l:'높음',c:'var(--brand)'}:total>=25?{l:'보통',c:'var(--accent-yellow)'}:{l:'낮음',c:'var(--accent-red)'};
  const strategy=total>=55?{t:'가점제 집중',d:'서울/수도권 인기 단지 1순위 가점제 당첨 가능성이 높습니다.',i:['서울/경기 85㎡ 이하 가점제 집중','추첨제보다 가점제가 유리한 구간','청약홈에서 가점 높은 순 정렬 확인']}
    :total>=40?{t:'가점+추첨 병행',d:'지방 광역시 가점제, 수도권 추첨제를 병행하세요.',i:['85㎡ 초과 추첨제 40% 물량','지방 광역시 가점제 도전','신혼부부 특별공급 자격 확인']}
    :total>=25?{t:'추첨제 + 특별공급',d:'추첨제와 특별공급에 집중하세요.',i:['85㎡ 초과 추첨제 40% 활용','생애최초 특별공급 (소득 기준)','신혼부부 특별공급 (혼인 7년 이내)']}
    :{t:'특별공급 집중',d:'특별공급 자격을 우선 확인하세요.',i:['신혼부부/생애최초/다자녀 특별공급','추첨제 85㎡ 초과 물량','무주택기간·통장 기간 꾸준히 쌓기']};

  const chip=(active:boolean)=>({padding:'9px 0',borderRadius:8,border:'none',cursor:'pointer',fontWeight:600 as const,fontSize:13,background:active?'var(--brand)':'var(--bg-hover)',color:active?'var(--text-inverse, #fff)':'var(--text-secondary)',flex:1,textAlign:'center' as const});
  const steps=['기본 정보','무주택기간','부양가족','통장 기간'];
  const ctr=(n:number,set:(v:number)=>void,min:number,max:number,label:string,sub?:string)=>(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
      <div><span style={{fontSize:13,color:'var(--text-primary)'}}>{label}</span>{sub&&<span style={{fontSize:10,color:'var(--text-tertiary)',display:'block'}}>{sub}</span>}</div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <button onClick={()=>set(Math.max(min,n-1))} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-primary)',cursor:'pointer',fontSize:16}}>-</button>
        <span style={{fontSize:16,fontWeight:800,minWidth:24,textAlign:'center'}}>{n}</span>
        <button onClick={()=>set(Math.min(max,n+1))} style={{width:32,height:32,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-primary)',cursor:'pointer',fontSize:16}}>+</button>
      </div>
    </div>
  );

  const card:React.CSSProperties={background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,padding:20,marginBottom:14};

  return (
    <div>
      {!showResult&&(
        <>
          <div style={{display:'flex',gap:4,marginBottom:20}}>
            {steps.map((s,i)=><button key={i} onClick={()=>setStep(i)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',cursor:'pointer',background:step===i?'var(--brand)':'var(--bg-hover)',color:step===i?'var(--text-inverse, #fff)':'var(--text-tertiary)',fontSize:11,fontWeight:700}}><span style={{display:'block',fontSize:14,marginBottom:1}}>{i+1}</span>{s}</button>)}
          </div>

          {step===0&&<div style={card}>
            <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:8}}>만 나이</label>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
              <input type="range" min={19} max={65} value={age} onChange={e=>setAge(+e.target.value)} style={{flex:1,accentColor:'var(--brand)'}}/>
              <span style={{fontSize:20,fontWeight:800,minWidth:60,textAlign:'right'}}>{age}세</span>
            </div>
            <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:8}}>혼인 여부</label>
            <div style={{display:'flex',gap:6,marginBottom:20}}>
              {[['yes','기혼'],['no','미혼']].map(([v,l])=><button key={v} onClick={()=>setMarried(v)} style={chip(married===v)}>{l}</button>)}
            </div>
            {!canCount&&<div style={{padding:'10px 12px',borderRadius:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',fontSize:12,color:'var(--accent-red)',lineHeight:1.6}}>만 30세 미만 미혼자는 무주택기간이 인정되지 않습니다.</div>}
          </div>}

          {step===1&&<div style={card}>
            <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4}}>무주택기간 (만점 32점)</label>
            <p style={{fontSize:11,color:'var(--text-tertiary)',margin:'0 0 12px',lineHeight:1.5}}>{married==='yes'?'혼인신고일 또는 만 30세 중 빠른 날부터 산정':age>=30?'만 30세부터 산정':'만 30세 미만 미혼 → 0점'}</p>
            {canCount?<>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <input type="range" min={0} max={15} value={housingYears} onChange={e=>setHousingYears(+e.target.value)} style={{flex:1,accentColor:'var(--brand)'}}/>
                <span style={{fontSize:20,fontWeight:800,minWidth:50,textAlign:'right'}}>{housingYears}년</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:12,color:'var(--text-tertiary)'}}>주택공급규칙 별표1</span><span style={{fontSize:16,fontWeight:800,color:'var(--brand)'}}>{hs}점 / 32점</span></div>
            </>:<div style={{padding:16,textAlign:'center',color:'var(--text-tertiary)',fontSize:14}}>무주택기간 산정 불가 (만 30세 미만 미혼)</div>}
          </div>}

          {step===2&&<div style={card}>
            <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4}}>부양가족 수 (만점 35점)</label>
            <p style={{fontSize:11,color:'var(--text-tertiary)',margin:'0 0 14px',lineHeight:1.5}}>본인 제외 · 배우자 포함 · 직계존속 3년 이상 등재 · 미혼 직계비속</p>
            {married==='yes'&&<div style={{marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:13}}>배우자</span><div style={{display:'flex',gap:4}}>{[0,1].map(n=><button key={n} onClick={()=>setSpouse(n)} style={{...chip(spouse===n),minWidth:50,flex:'none'}}>{n?'포함':'미포함'}</button>)}</div></div></div>}
            {ctr(children,setChildren,0,6,'미혼 자녀')}
            {ctr(parents,setParents,0,4,'직계존속 (부모/조부모)','3년 이상 주민등록 등재')}
            {ctr(siblings,setSiblings,0,4,'미혼 형제·자매','무주택 + 부모 사망 시')}
            <div style={{borderTop:'1px solid var(--border)',paddingTop:12,display:'flex',justifyContent:'space-between'}}>
              <span style={{fontSize:13,color:'var(--text-secondary)'}}>합계: <strong>{fc}명</strong></span>
              <span style={{fontSize:16,fontWeight:800,color:'var(--brand)'}}>{fs}점 / 35점</span>
            </div>
          </div>}

          {step===3&&<div style={card}>
            <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4}}>내 청약통장 가입기간 (만점 17점)</label>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <input type="range" min={0} max={15} step={1} value={bankYears} onChange={e=>setBankYears(+e.target.value)} style={{flex:1,accentColor:'var(--brand)'}}/>
              <span style={{fontSize:20,fontWeight:800,minWidth:50,textAlign:'right'}}>{bankYears}년</span>
            </div>
            {married==='yes'&&<>
              <label style={{fontSize:13,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4}}>배우자 청약통장 가입기간</label>
              <p style={{fontSize:10,color:'var(--text-tertiary)',margin:'0 0 8px'}}>배우자 통장 50% 인정, 최대 3점 합산 (규칙 제28조)</p>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <input type="range" min={0} max={15} step={1} value={spouseBankYears} onChange={e=>setSpouseBankYears(+e.target.value)} style={{flex:1,accentColor:'var(--accent-purple, #A78BFA)'}}/>
                <span style={{fontSize:16,fontWeight:800,minWidth:50,textAlign:'right'}}>{spouseBankYears}년</span>
              </div>
            </>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:12,color:'var(--text-tertiary)'}}>내 {myBank}점{spouseBank>0?` + 배우자 ${spouseBank}점`:''}</span>
              <span style={{fontSize:16,fontWeight:800,color:'var(--brand)'}}>{bs}점 / 17점</span>
            </div>
          </div>}

          <div style={{...card,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div><div style={{fontSize:11,color:'var(--text-tertiary)'}}>현재 예상 가점</div><div style={{fontSize:28,fontWeight:900,color:grade.c}}>{total}<span style={{fontSize:14}}>점</span></div></div>
            <div style={{display:'flex',gap:6}}>
              {step>0&&<button onClick={()=>setStep(step-1)} style={{padding:'10px 18px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-primary)',cursor:'pointer',fontWeight:600,fontSize:13}}>이전</button>}
              {step<3?<button onClick={()=>setStep(step+1)} style={{padding:'10px 18px',borderRadius:10,border:'none',background:'var(--brand)',color:'var(--text-inverse, #fff)',cursor:'pointer',fontWeight:700,fontSize:13}}>다음</button>
              :<button onClick={()=>{setShowResult(true);trackFeature('calc_result',{calculator:'apt_score',total})}} style={{padding:'10px 24px',borderRadius:10,border:'none',background:'var(--brand)',color:'var(--text-inverse, #fff)',cursor:'pointer',fontWeight:700,fontSize:14}}>결과 보기</button>}
            </div>
          </div>
        </>
      )}

      {showResult&&(
        <>
          <div className="diagnose-result" style={{...card,textAlign:'center',padding:28}}>
            <div style={{fontSize:12,color:'var(--text-tertiary)',marginBottom:4}}>내 청약 가점</div>
            <div style={{fontSize:56,fontWeight:900,color:grade.c,lineHeight:1}}>{total}</div>
            <div style={{fontSize:14,fontWeight:600,color:grade.c,marginTop:4,marginBottom:16}}>{grade.l} · 상위 {Math.max(1,100-pct)}%</div>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:16}}>
              {[{l:'무주택',s:hs,m:32,c:'var(--accent-blue, #60A5FA)'},{l:'부양가족',s:fs,m:35,c:'var(--accent-green)'},{l:'통장',s:bs,m:17,c:'var(--accent-yellow)'}].map(i=>(
                <div key={i.l} style={{flex:1,padding:'10px 8px',borderRadius:10,background:'var(--bg-hover)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text-tertiary)',marginBottom:4}}>{i.l}</div>
                  <div style={{fontSize:20,fontWeight:800,color:i.c}}>{i.s}</div>
                  <div style={{fontSize:10,color:'var(--text-tertiary)'}}>/ {i.m}점</div>
                  <div style={{height:3,borderRadius:2,background:'var(--bg-hover)',marginTop:6,overflow:'hidden'}}><div style={{height:'100%',width:`${(i.s/i.m)*100}%`,background:i.c,borderRadius:2}}/></div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={()=>{
                const text=`내 청약 가점: ${total}점/84점 (${grade.l})\n무주택 ${hs}/32 · 부양가족 ${fs}/35 · 통장 ${bs}/17\n추천전략: ${strategy.t}\n\n카더라에서 내 가점 진단해보기`;
                const url='https://kadeora.app/apt/diagnose';
                if(typeof window!=='undefined'&&(window as unknown as Record<string,unknown>).Kakao){try{((window as unknown as Record<string,unknown>).Kakao as Record<string,unknown> as {Share:{sendDefault:(o:unknown)=>void}}).Share.sendDefault({objectType:'feed',content:{title:'청약 가점 진단 결과',description:text.slice(0,100),imageUrl:`${url.replace('/apt/diagnose','')}/api/og?title=${encodeURIComponent('청약 가점 '+total+'점')}`,link:{mobileWebUrl:url,webUrl:url}}});}catch{navigator.share?.({title:'청약 가점 진단',text,url}).catch(()=>{});}}
                else if(navigator.share)navigator.share({title:'청약 가점 진단 결과',text,url}).catch(()=>{});
                else navigator.clipboard.writeText(text+'\n'+url).then(()=>alert('복사되었습니다!'));
              }} style={{padding:'10px 20px',borderRadius:8,border:'none',cursor:'pointer',background:'var(--brand)',color:'#fff',fontSize:13,fontWeight:700}}>결과 공유</button>
              <button onClick={()=>setShowResult(false)} style={{padding:'10px 20px',borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',background:'var(--bg-hover)',color:'var(--text-secondary)',fontSize:13,fontWeight:600}}>다시 계산</button>
            </div>
          </div>

          <div style={{...card,borderLeft:'3px solid var(--brand)',borderRadius:'0 12px 12px 0'}}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>추천 전략: {strategy.t}</div>
            <div style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.7,marginBottom:12}}>{strategy.d}</div>
            {strategy.i.map((item,i)=><div key={i} style={{display:'flex',gap:8,marginBottom:6,fontSize:13,color:'var(--text-secondary)'}}><span style={{color:'var(--brand)',flexShrink:0}}>•</span><span style={{lineHeight:1.5}}>{item}</span></div>)}
          </div>

          <div style={card}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>지역별 당첨 가능성</div>
            <div style={{fontSize:11,color:'var(--text-tertiary)',marginBottom:14}}>최근 청약 실적 기반 추정 · 단지별 차이 있음</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(95px, 1fr))',gap:4}}>
              {CUTS.map(c=>{const w=total>=c.avg;const p=total>=c.min;return(
                <div key={c.r} style={{padding:'8px 10px',borderRadius:8,textAlign:'center',background:w?'rgba(52,211,153,0.06)':p?'rgba(251,191,36,0.06)':'var(--bg-hover)',border:`1px solid ${w?'rgba(52,211,153,0.2)':p?'rgba(251,191,36,0.2)':'var(--border)'}`}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{c.r}</div>
                  <div style={{fontSize:10,color:w?'var(--accent-green)':p?'var(--accent-yellow)':'var(--accent-red)',fontWeight:600}}>{w?'유리':p?'가능':'어려움'}</div>
                  <div style={{fontSize:9,color:'var(--text-tertiary)'}}>avg {c.avg}점</div>
                </div>
              );})}
            </div>
          </div>

          <div style={card}>
            <div style={{fontSize:15,fontWeight:800,marginBottom:12}}>가점 올리는 법</div>
            {[hs<32&&`무주택기간: ${housingYears}년 → ${Math.min(15,housingYears+3)}년이면 +${gs(HT,Math.min(15,housingYears+3))-hs}점`,
              fs<35&&'부양가족: 배우자·직계존속·비속 무주택 확인 후 주민등록 등재',
              bs<17&&`청약통장: 유지만 하면 매년 +1점. ${Math.ceil(15-bankYears)}년 후 만점`,
              married==='yes'&&spouseBank===0&&'배우자 통장 합산: 배우자 청약통장도 50% 인정(최대 3점)',
              total<40&&'85㎡ 초과 주택은 추첨제 40% — 가점 낮아도 당첨 가능',
              '신혼부부·생애최초 특별공급은 가점 무관, 소득·자산 기준',
            ].filter(Boolean).map((tip,i)=><div key={i} style={{display:'flex',gap:8,marginBottom:8,fontSize:13,color:'var(--text-secondary)',lineHeight:1.6}}><span style={{color:'var(--accent-yellow)',flexShrink:0,fontWeight:700,fontSize:11}}>TIP</span><span>{tip}</span></div>)}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:24}}>
            <Link href="/apt" style={{flex:1,display:'block',textAlign:'center',padding:'12px 0',background:'var(--brand)',color:'#fff',borderRadius:10,fontSize:14,fontWeight:700,textDecoration:'none'}}>청약 일정 보기</Link>
            <Link href="/apt?tab=ongoing" style={{flex:1,display:'block',textAlign:'center',padding:'12px 0',background:'var(--bg-surface)',color:'var(--text-primary)',borderRadius:10,fontSize:14,fontWeight:700,textDecoration:'none',border:'1px solid var(--border)'}}>분양중 현장</Link>
          </div>
        </>
      )}
      <div style={{marginTop:8}}><SectionShareButton section="apt-diagnose" label="청약 가점 진단 — 내 가점은 몇 점?" pagePath="/apt/diagnose" /></div>
    </div>
  );
}
