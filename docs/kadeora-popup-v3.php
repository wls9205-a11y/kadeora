<?php
/**
 * Plugin Name: 카더라 팝업 v3
 * Description: 즉시 로딩 팝업 (1초 이내 표시)
 * Version: 3.0
 * Author: 카더라
 */

// 팝업을 wp_head 최우선 순위로 삽입
add_action('wp_head', function() {
?>
<style id="kd-popup-css">
.kd-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;pointer-events:none}
.kd-ov.on{opacity:1;pointer-events:auto}
.kd-pp{background:#fff;border-radius:16px;max-width:380px;width:92vw;padding:28px 24px 20px;text-align:center;transform:translateY(20px) scale(.95);transition:transform .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 20px 60px rgba(0,0,0,.3)}
.kd-ov.on .kd-pp{transform:translateY(0) scale(1)}
.kd-pp h2{margin:0 0 8px;font-size:20px;font-weight:800;color:#1a1a2e;line-height:1.3}
.kd-pp p{margin:0 0 18px;font-size:14px;color:#666;line-height:1.6}
.kd-pp .kb{display:block;width:100%;padding:14px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none;margin-bottom:8px;transition:transform .1s;box-sizing:border-box}
.kd-pp .kb:active{transform:scale(.97)}
.kd-pp .kp{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff}
.kd-pp .kg{background:transparent;color:#999;font-size:13px;font-weight:500;padding:8px;margin:0}
.kd-pp .kt{display:inline-block;background:#f0f7ff;color:#2563eb;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:14px}
</style>
<script>
(function(){
if(document.cookie.indexOf('kd_hide=1')!==-1)return;
function go(){
var o=document.createElement('div');o.className='kd-ov';
o.innerHTML='<div class="kd-pp">'
+'<div class="kt">🏠 부동산 투자 정보</div>'
+'<h2>청약·분양 정보를<br>한눈에 확인하세요</h2>'
+'<p>전국 2,700+ 분양현장 분석<br>실시간 청약 경쟁률 · 142종 무료 계산기</p>'
+'<a class="kb kp" href="https://kadeora.app?utm_source=wp&utm_medium=popup&utm_campaign=v3" target="_blank" rel="noopener">카더라 바로가기 →</a>'
+'<button class="kb kg" id="kd-x">오늘 하루 보지 않기</button></div>';
document.body.appendChild(o);
requestAnimationFrame(function(){requestAnimationFrame(function(){o.classList.add('on')})});
function cl(){o.classList.remove('on');setTimeout(function(){o.remove()},300);var d=new Date();d.setTime(d.getTime()+864e5);document.cookie='kd_hide=1;expires='+d.toUTCString()+';path=/;SameSite=Lax'}
document.getElementById('kd-x').onclick=cl;
o.onclick=function(e){if(e.target===o)cl()};
}
if(document.body)go();else document.addEventListener('DOMContentLoaded',go,{once:true});
})();
</script>
<?php
}, 1);
