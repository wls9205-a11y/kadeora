const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist', 'web');
if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

const API = 'https://kadeora.app/api/toss/feed';
const BASE = 'https://kadeora.app';

fs.writeFileSync(path.join(dist, 'index.html'), `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>카더라</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;background:#fff;color:#191F28;-webkit-font-smoothing:antialiased}
    .loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:40vh;color:#8B95A1;font-size:14px;gap:12px}
    .spinner{width:24px;height:24px;border:3px solid #E5E8EB;border-top-color:#3182F6;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .tabs{display:flex;border-bottom:1px solid #E5E8EB;position:sticky;top:0;background:#fff;z-index:10}
    .tab{flex:1;padding:12px 0;text-align:center;font-size:13px;font-weight:600;color:#8B95A1;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
    .tab.active{color:#3182F6;border-bottom-color:#3182F6}
    .section{padding:12px 16px}
    .card{background:#F7F8FA;border-radius:12px;padding:14px 16px;margin-bottom:10px;text-decoration:none;display:block;color:inherit;transition:background .1s}
    .card:active{background:#ECEEF0}
    .card-title{font-size:14px;font-weight:600;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .card-meta{font-size:11px;color:#8B95A1;display:flex;gap:8px;align-items:center}
    .cat{display:inline-block;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-right:4px}
    .cat-stock{background:#E8F5E9;color:#2E7D32}.cat-apt{background:#E3F2FD;color:#1565C0}.cat-free{background:#FFF3E0;color:#E65100}.cat-local{background:#F3E5F5;color:#7B1FA2}
    .stock-row{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #F2F3F5;text-decoration:none;color:inherit}
    .stock-row:last-child{border-bottom:none}
    .stock-name{flex:1}.stock-name strong{font-size:14px;display:block}.stock-name small{font-size:11px;color:#8B95A1}
    .stock-price{text-align:right}.stock-price strong{font-size:14px;display:block}
    .stock-change{font-size:12px;font-weight:600}
    .up{color:#F04452}.down{color:#3182F6}.flat{color:#8B95A1}
    .hot-item{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #F2F3F5;text-decoration:none;color:inherit}
    .hot-rank{width:20px;font-size:14px;font-weight:800;text-align:center}
    .hot-rank.r1{color:#3182F6}.hot-rank.r2{color:#4E5968}.hot-rank.r3{color:#8B95A1}
    .hot-title{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .hot-likes{font-size:11px;color:#F04452;flex-shrink:0}
    .menu-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px 16px}
    .menu-item{display:flex;flex-direction:column;align-items:center;gap:5px;text-decoration:none;color:#191F28}
    .menu-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px}
    .menu-label{font-size:10px;font-weight:600}
    .empty{text-align:center;padding:40px;color:#8B95A1;font-size:13px}
    .hero{padding:16px 16px 4px;display:flex;align-items:center;justify-content:space-between}
    .hero-title{font-size:18px;font-weight:800;color:#191F28}
    .hero-sub{font-size:11px;color:#8B95A1;margin-top:1px}
    .hero-badge{font-size:9px;font-weight:700;color:#3182F6;background:#EBF5FF;padding:3px 8px;border-radius:10px}
    .st{font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:4px}
    .sub-card{background:#F7F8FA;border-radius:12px;padding:12px 16px;margin-bottom:8px;text-decoration:none;display:block;color:inherit}
    .sub-card:active{background:#ECEEF0}
    .sub-name{font-size:14px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sub-meta{font-size:11px;color:#8B95A1;display:flex;gap:6px;flex-wrap:wrap}
    .sub-badge{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:#FEE;color:#D32F2F;margin-right:4px}
    .blog-item{padding:10px 0;border-bottom:1px solid #F2F3F5;text-decoration:none;display:block;color:inherit}
    .blog-item:last-child{border-bottom:none}
    .blog-title{font-size:13px;font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .blog-excerpt{font-size:11px;color:#8B95A1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .share-btn{position:fixed;right:16px;bottom:20px;width:48px;height:48px;border-radius:50%;background:#3182F6;color:#fff;border:none;font-size:18px;cursor:pointer;box-shadow:0 4px 12px rgba(49,130,246,.35);display:flex;align-items:center;justify-content:center;z-index:20}
    .more-link{display:block;text-align:center;padding:10px 0;font-size:12px;color:#3182F6;font-weight:600;text-decoration:none}
  </style>
</head>
<body>
  <div class="hero">
    <div>
      <div class="hero-title">카더라</div>
      <div class="hero-sub">주식 · 청약 · 커뮤니티</div>
    </div>
    <span class="hero-badge">실시간</span>
  </div>
  <div class="menu-grid">
    <a class="menu-item" href="${BASE}/feed?toss=1"><div class="menu-icon" style="background:#EBF5FF">📰</div><span class="menu-label">피드</span></a>
    <a class="menu-item" href="${BASE}/stock?toss=1"><div class="menu-icon" style="background:#E8F5E9">📈</div><span class="menu-label">주식</span></a>
    <a class="menu-item" href="${BASE}/apt?toss=1"><div class="menu-icon" style="background:#E3F2FD">🏢</div><span class="menu-label">청약</span></a>
    <a class="menu-item" href="${BASE}/blog?toss=1"><div class="menu-icon" style="background:#FFF3E0">📝</div><span class="menu-label">블로그</span></a>
    <a class="menu-item" href="${BASE}/search?toss=1"><div class="menu-icon" style="background:#F3E5F5">🔍</div><span class="menu-label">검색</span></a>
  </div>
  <div class="tabs">
    <button class="tab active" data-tab="feed">최신글</button>
    <button class="tab" data-tab="hot">인기</button>
    <button class="tab" data-tab="stock">주식</button>
    <button class="tab" data-tab="sub">청약</button>
    <button class="tab" data-tab="blog">블로그</button>
  </div>
  <div id="content"><div class="loading"><div class="spinner"></div>불러오는 중...</div></div>
  <button class="share-btn" onclick="tossShare()" aria-label="공유하기">↗</button>

  <script>
    /* 반려#2,3: 뒤로가기 — 토스 네이티브만 사용, 최초화면 앱 종료 */
    var _iHL=history.length;
    window.addEventListener('popstate',function(){
      if(history.length<=_iHL){try{if(window.TossApp&&TossApp.close){TossApp.close();return;}}catch(e){}try{location.href='intoss://close';}catch(e){}}
    });

    /* 반려#1: 공유 → intoss/toss 스킴 */
    function tossShare(){
      var t='카더라 — 주식·청약·커뮤니티',u='${BASE}?toss=1';
      try{if(window.TossApp&&TossApp.share){TossApp.share({title:t,url:u});return;}}catch(e){}
      try{location.href='intoss://miniapp/kadeora?title='+encodeURIComponent(t);return;}catch(e){}
      if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});}
    }

    var data=null,currentTab='feed';
    var catL={stock:'주식',apt:'부동산',free:'자유',local:'우리동네',finance:'재테크'};
    var catC={stock:'cat-stock',apt:'cat-apt',free:'cat-free',local:'cat-local',finance:'cat-apt'};

    function tA(d){var s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return'방금';if(s<3600)return Math.floor(s/60)+'분 전';if(s<86400)return Math.floor(s/3600)+'시간 전';return Math.floor(s/86400)+'일 전';}
    function fP(n,c){if(c==='USD')return'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});return Number(n).toLocaleString('ko-KR')+'원';}

    document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){
      currentTab=this.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
      this.classList.add('active');render();
    });});

    function render(){
      var el=document.getElementById('content');
      if(!data){el.innerHTML='<div class="loading"><div class="spinner"></div>불러오는 중...</div>';return;}

      if(currentTab==='feed'){
        if(!data.posts||!data.posts.length){el.innerHTML='<div class="empty">게시글이 없습니다</div>';return;}
        el.innerHTML='<div class="section">'+data.posts.map(function(p){
          return'<a class="card" href="${BASE}/feed/'+p.id+'?toss=1"><div class="card-title"><span class="cat '+(catC[p.category]||'')+'\">'+(catL[p.category]||p.category)+'</span> '+p.title+'</div><div class="card-meta"><span>'+p.author+'</span><span>♥ '+(p.likes||0)+'</span><span>💬 '+(p.comments||0)+'</span><span>'+tA(p.time)+'</span></div></a>';
        }).join('')+'<a class="more-link" href="${BASE}/feed?toss=1">전체 보기 →</a></div>';
      }

      if(currentTab==='hot'){
        if(!data.hot||!data.hot.length){el.innerHTML='<div class="empty">인기글이 없습니다</div>';return;}
        el.innerHTML='<div class="section"><div class="st">🔥 이번주 인기글</div>'+data.hot.map(function(p,i){
          var rc=i<1?'r1':i<2?'r2':'r3';
          return'<a class="hot-item" href="${BASE}/feed/'+p.id+'?toss=1"><span class="hot-rank '+rc+'">'+(i+1)+'</span><span class="hot-title">'+p.title+'</span><span class="hot-likes">♥ '+(p.likes||0)+'</span></a>';
        }).join('')+'<a class="more-link" href="${BASE}/hot?toss=1">전체 보기 →</a></div>';
      }

      if(currentTab==='stock'){
        if(!data.stocks||!data.stocks.length){el.innerHTML='<div class="empty">주식 데이터 로딩 중</div>';return;}
        el.innerHTML='<div class="section"><div class="st">📈 시총 상위 종목</div>'+data.stocks.map(function(s){
          var ch=Number(s.change),cls=ch>0?'up':ch<0?'down':'flat',sgn=ch>0?'+':'';
          return'<a class="stock-row" href="${BASE}/stock/'+s.symbol+'?toss=1"><div class="stock-name"><strong>'+s.name+'</strong><small>'+(s.market||'')+' · '+(s.sector||'')+'</small></div><div class="stock-price"><strong>'+fP(s.price,s.currency||'KRW')+'</strong><span class="stock-change '+cls+'">'+sgn+ch+'%</span></div></a>';
        }).join('')+'<a class="more-link" href="${BASE}/stock?toss=1">전체 보기 →</a></div>';
      }

      if(currentTab==='sub'){
        if(!data.subscriptions||!data.subscriptions.length){el.innerHTML='<div class="empty">접수중인 청약이 없습니다</div>';return;}
        el.innerHTML='<div class="section"><div class="st">🏢 접수중 · 예정 청약</div>'+data.subscriptions.map(function(a){
          var bd='';if(a.regulated)bd='<span class="sub-badge">규제지역</span>';
          return'<a class="sub-card" href="${BASE}/apt/'+a.id+'?toss=1"><div class="sub-name">'+bd+a.name+'</div><div class="sub-meta"><span>📍 '+(a.region||'')+'</span><span>🏠 '+(a.total||0)+'세대</span>'+(a.general?'<span>일반 '+a.general+'</span>':'')+(a.special?'<span>특별 '+a.special+'</span>':'')+'<span>📅 '+(a.start||'')+' ~ '+(a.end||'')+'</span></div></a>';
        }).join('')+'<a class="more-link" href="${BASE}/apt?toss=1">전체 보기 →</a></div>';
      }

      if(currentTab==='blog'){
        if(!data.blogs||!data.blogs.length){el.innerHTML='<div class="empty">블로그 글이 없습니다</div>';return;}
        el.innerHTML='<div class="section"><div class="st">📝 최신 블로그</div>'+data.blogs.map(function(b){
          return'<a class="blog-item" href="${BASE}/blog/'+b.slug+'?toss=1"><div class="blog-title">'+b.title+'</div><div class="blog-excerpt">'+(b.excerpt||'')+'</div></a>';
        }).join('')+'<a class="more-link" href="${BASE}/blog?toss=1">전체 보기 →</a></div>';
      }
    }

    fetch('${API}').then(function(r){return r.json()}).then(function(d){data=d;render()}).catch(function(){
      document.getElementById('content').innerHTML='<div class="empty">데이터를 불러올 수 없습니다.<br>잠시 후 다시 시도해주세요.</div>';
    });
  </script>
</body>
</html>`);

console.log('Web build done — dist/web/index.html');
