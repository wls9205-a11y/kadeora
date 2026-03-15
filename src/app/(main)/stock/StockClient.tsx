'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { StockQuote } from '@/types/database';

function fmt(n: number | null | undefined) { if (!n) return '-'; return n.toLocaleString('ko-KR'); }
function fmtVol(n: number | null | undefined) {
  if (!n) return '-';
  if (n >= 100000000) return (n/100000000).toFixed(1)+'억주';
  if (n >= 10000) return (n/10000).toFixed(0)+'만주';
  return n.toLocaleString()+'주';
}

export default function StockClient({ initialStocks, isDemo }: { initialStocks: StockQuote[]; isDemo: boolean }) {
  const [stocks, setStocks] = useState<StockQuote[]>(initialStocks);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isDemo) return;
    const sb = createSupabaseBrowser();
    const ch = sb.channel('stocks').on('postgres_changes',{event:'UPDATE',schema:'public',table:'stock_quotes'},
      p => setStocks(prev => prev.map(s => s.symbol === (p.new as StockQuote).symbol ? p.new as StockQuote : s))
    ).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [isDemo]);

  const filtered = stocks.filter(s => !search || s.name.includes(search) || s.symbol.includes(search));
  const rising = stocks.filter(s => (s.change_pct ?? 0) > 0).length;
  const falling = stocks.filter(s => (s.change_pct ?? 0) < 0).length;

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <h1 style={{margin:0,fontSize:22,fontWeight:800,color:'#F1F5F9'}}>📈 실시간 주식 시세</h1>
        {isDemo && <span style={{fontSize:12,padding:'4px 10px',borderRadius:999,background:'rgba(59,130,246,0.1)',color:'#3B82F6',border:'1px solid rgba(59,130,246,0.3)'}}>💡 미리보기</span>}
        {!isDemo && <span style={{fontSize:12,color:'#10B981',display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:'#10B981',display:'inline-block'}}/>실시간</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
        {[{label:'상승',value:rising+'개',color:'#10B981'},{label:'하락',value:falling+'개',color:'#EF4444'},{label:'시장',value:rising>falling?'강세':'약세',color:rising>falling?'#10B981':'#EF4444'}].map(i=>(
          <div key={i.label} style={{background:'#111827',border:'1px solid #1E293B',borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:12,color:'#64748B',marginBottom:4}}>{i.label}</div>
            <div style={{fontSize:20,fontWeight:800,color:i.color}}>{i.value}</div>
          </div>
        ))}
      </div>
      <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="종목명 또는 코드 검색..."
        style={{width:'100%',maxWidth:280,background:'#1a2234',border:'1px solid #1E293B',borderRadius:8,color:'#F1F5F9',padding:'10px 14px',fontSize:14,marginBottom:16,fontFamily:'inherit'}} />
      <div style={{background:'#111827',border:'1px solid #1E293B',borderRadius:14,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
            <thead><tr style={{borderBottom:'1px solid #1E293B'}}>
              {['종목','현재가','등락','등락률','거래량'].map(h=>(
                <th key={h} style={{padding:'12px 16px',color:'#64748B',fontWeight:600,fontSize:12,textAlign:h==='종목'?'left':'right'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((s,i)=>{
                const up=(s.change_pct??0)>0, dn=(s.change_pct??0)<0;
                const c=up?'#10B981':dn?'#EF4444':'#94A3B8';
                return (
                  <tr key={s.symbol} style={{borderBottom:i<filtered.length-1?'1px solid #0f1620':'none'}}>
                    <td style={{padding:'14px 16px'}}><div style={{fontWeight:700,color:'#F1F5F9'}}>{s.name}</div><div style={{fontSize:11,color:'#64748B'}}>{s.symbol}</div></td>
                    <td style={{padding:'14px 16px',textAlign:'right',fontWeight:700,color:'#F1F5F9'}}>{fmt(s.price)}원</td>
                    <td style={{padding:'14px 16px',textAlign:'right',color:c,fontWeight:600}}>{up?'+':''}{fmt(s.change_amt)}</td>
                    <td style={{padding:'14px 16px',textAlign:'right'}}>
                      <span style={{padding:'2px 8px',borderRadius:6,fontSize:12,fontWeight:700,background:up?'rgba(16,185,129,0.15)':dn?'rgba(239,68,68,0.15)':'transparent',color:c}}>
                        {up?'▲':dn?'▼':'━'} {Math.abs(s.change_pct??0).toFixed(2)}%
                      </span>
                    </td>
                    <td style={{padding:'14px 16px',textAlign:'right',color:'#94A3B8'}}>{fmtVol(s.volume)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{marginTop:12,fontSize:12,color:'#475569',textAlign:'right'}}>※ 투자 참고용 정보입니다.</p>
    </div>
  );
}