/**
 * 카더라 팝업 v3 — 즉시 로딩 (1초 이내)
 * 
 * WordPress mu-plugins/kadeora-popup.php의 <script> 안에 넣을 코드
 * 
 * 변경점 (v2 → v3):
 * - DOMContentLoaded 대기 제거 → 인라인 즉시 실행
 * - setTimeout 제거 → requestAnimationFrame으로 1프레임 후 표시
 * - CSS를 JS로 동적 주입 → <style> 인라인으로 변경 (파싱 차단 없음)
 * - 이미지 preload 제거 → CSS only 팝업 (네트워크 대기 0)
 * - 오늘하루 보지않기 쿠키 체크를 최상단으로 이동 (불필요 DOM 조작 방지)
 * 
 * 사용법:
 * 1. Hostinger hPanel → WordPress → mu-plugins 폴더
 * 2. kadeora-popup.php 파일의 기존 <script> 부분을 아래 코드로 교체
 * 3. 또는 WordPress Admin → Appearance → Theme Editor → header.php에 삽입
 */

// ─── PHP 래퍼 (mu-plugin용) ───
// 파일명: wp-content/mu-plugins/kadeora-popup.php
`
<?php
/**
 * Plugin Name: 카더라 팝업 v3
 * Description: 1초 즉시 로딩 팝업
 */
add_action('wp_head', function() {
?>
<style id="kd-popup-css">
.kd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s ease;pointer-events:none}
.kd-overlay.show{opacity:1;pointer-events:auto}
.kd-popup{background:#fff;border-radius:16px;max-width:380px;width:92vw;padding:28px 24px 20px;text-align:center;transform:translateY(20px) scale(0.95);transition:transform .3s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.kd-overlay.show .kd-popup{transform:translateY(0) scale(1)}
.kd-popup h2{margin:0 0 8px;font-size:20px;font-weight:800;color:#1a1a2e;line-height:1.3}
.kd-popup p{margin:0 0 18px;font-size:14px;color:#666;line-height:1.6}
.kd-popup .kd-btn{display:block;width:100%;padding:14px 0;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;margin-bottom:8px;transition:transform .1s}
.kd-popup .kd-btn:active{transform:scale(0.97)}
.kd-popup .kd-primary{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff}
.kd-popup .kd-ghost{background:transparent;color:#999;font-size:13px;font-weight:500;padding:8px 0;margin:0}
.kd-popup .kd-badge{display:inline-block;background:#f0f7ff;color:#2563eb;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px}
</style>
<script>
(function(){
  // 쿠키 체크 — 최상단에서 즉시 리턴 (DOM 조작 0)
  if(document.cookie.indexOf('kd_popup_hide=1')!==-1) return;
  
  // 팝업 HTML 생성
  var el=document.createElement('div');
  el.className='kd-overlay';
  el.id='kd-overlay';
  el.innerHTML='<div class="kd-popup">'
    +'<div class="kd-badge">🏠 부동산 투자 정보</div>'
    +'<h2>청약·분양 정보를<br>한눈에 확인하세요</h2>'
    +'<p>전국 2,700+ 분양현장 분석<br>실시간 청약 경쟁률 · AI 투자 리포트</p>'
    +'<a class="kd-btn kd-primary" href="https://kadeora.app?utm_source=satellite&utm_medium=popup&utm_campaign=v3" target="_blank" rel="noopener">카더라 바로가기 →</a>'
    +'<button class="kd-btn kd-ghost" id="kd-close">오늘 하루 보지 않기</button>'
    +'</div>';
  
  // body에 즉시 삽입 (DOMContentLoaded 대기 X)
  function inject(){
    document.body.appendChild(el);
    // 1프레임 후 show (CSS 트랜지션 작동)
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        el.classList.add('show');
      });
    });
    // 닫기
    document.getElementById('kd-close').onclick=function(){
      el.classList.remove('show');
      setTimeout(function(){el.remove()},300);
      // 24시간 쿠키
      var d=new Date();d.setTime(d.getTime()+86400000);
      document.cookie='kd_popup_hide=1;expires='+d.toUTCString()+';path=/;SameSite=Lax';
    };
    // 오버레이 클릭으로도 닫기
    el.onclick=function(e){
      if(e.target===el){
        document.getElementById('kd-close').click();
      }
    };
  }
  
  // body 존재 확인 (head에서 실행되므로)
  if(document.body){
    inject();
  }else{
    // body가 아직 없으면 가장 빠른 시점에 삽입
    document.addEventListener('DOMContentLoaded',inject,{once:true});
  }
})();
</script>
<?php
}, 1); // priority 1 = 가장 먼저 실행
`
