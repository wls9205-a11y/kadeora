'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DailyReportData } from '@/lib/daily-report-data';
import { useAuth } from '@/components/AuthProvider';
import ShareButtons from '@/components/ShareButtons';
import Disclaimer from '@/components/Disclaimer';

// ═══ 오늘의 운세 (띠별) — 세밀 버전 + DB 저장 ═══
const ZA = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];
const ZE: Record<string,string> = {'쥐':'🐭','소':'🐮','호랑이':'🐯','토끼':'🐰','용':'🐲','뱀':'🐍','말':'🐴','양':'🐑','원숭이':'🐵','닭':'🐔','개':'🐶','돼지':'🐷'};

interface FortuneDetail { summary: string; money: string; love: string; health: string; lucky: string; }
const ZF: Record<string, FortuneDetail[]> = {
  '쥐': [
    { summary: '오늘은 정보력이 빛을 발하는 날입니다. 평소 관심 두던 종목이나 매물에 대해 결정적인 뉴스를 접할 수 있어요. 점심 무렵 들어오는 소식에 귀를 기울이세요.', money: '소액 분산투자가 유리합니다. 한 곳에 몰빵하지 마세요.', love: '오래된 인연에게 연락이 올 수 있어요. 반가운 소식과 함께.', health: '눈의 피로에 주의. 30분마다 먼 곳을 바라보세요.', lucky: '행운의 색: 파란색 / 행운의 숫자: 3, 7' },
    { summary: '주변 사람들과의 대화에서 투자 힌트를 얻을 수 있는 날이에요. 특히 선배나 경험 많은 지인의 조언에 귀 기울여보세요. 저녁에 좋은 기회가 찾아올 수 있습니다.', money: '적금이나 예금 같은 안전자산 점검하기 좋은 날.', love: '가족과의 저녁 식사가 마음을 따뜻하게 해줄 거예요.', health: '소화에 신경 쓰세요. 과식은 금물입니다.', lucky: '행운의 색: 흰색 / 행운의 숫자: 1, 8' },
    { summary: '새로운 재테크 방법을 알게 되는 날. SNS나 커뮤니티에서 유용한 정보를 발견할 가능성이 높아요. 단, 검증되지 않은 정보에는 신중하게 접근하세요.', money: 'ETF나 인덱스 펀드 같은 분산투자 상품이 눈에 들어올 거예요.', love: '동료와의 협업에서 시너지가 폭발합니다.', health: '가벼운 산책이 컨디션 회복에 도움이 됩니다.', lucky: '행운의 색: 초록색 / 행운의 숫자: 4, 9' },
    { summary: '조용히 혼자만의 시간을 가지며 포트폴리오를 점검해보세요. 그동안 놓쳤던 비효율적인 부분을 발견하고 정리할 수 있는 좋은 타이밍입니다.', money: '불필요한 구독 서비스나 자동이체를 정리하면 의외의 절약이.', love: '연인이나 배우자와 재무 계획을 함께 세워보세요.', health: '충분한 수면이 내일의 판단력을 좌우합니다.', lucky: '행운의 색: 검정 / 행운의 숫자: 2, 6' },
  ],
  '소': [
    { summary: '꾸준히 지켜온 투자 원칙이 드디어 성과를 보여주는 날이에요. 장기 보유 중인 자산에서 기분 좋은 변화를 확인할 수 있습니다. 조급해하지 말고 원래 계획을 유지하세요.', money: '배당주나 부동산 리츠 등 안정적인 수익형 자산이 유리해요.', love: '묵묵히 곁에 있어준 사람에게 감사 표현을 해보세요.', health: '목과 어깨 스트레칭이 필요한 날. 자세를 점검하세요.', lucky: '행운의 색: 갈색 / 행운의 숫자: 5, 8' },
    { summary: '부동산 관련 좋은 소식이 들려올 수 있는 날입니다. 전세 시세나 매매가 변동에 주의를 기울이세요. 특히 실거주 목적의 움직임이라면 적극적으로 알아보세요.', money: '월세 수익형 부동산에 대한 정보를 수집하기 좋은 날.', love: '가정의 평화가 모든 성공의 기반이에요. 가족 시간을 늘려보세요.', health: '등산이나 걷기 등 하체 운동이 기운을 북돋아줍니다.', lucky: '행운의 색: 노란색 / 행운의 숫자: 2, 7' },
    { summary: '직장이나 사업에서 신뢰를 쌓아온 결과가 빛나는 날이에요. 상사나 거래처로부터 긍정적인 피드백을 받을 수 있고, 이것이 간접적으로 재정 상황에도 좋은 영향을 줍니다.', money: '성과급이나 보너스와 관련된 좋은 소식이 있을 수 있어요.', love: '진심 어린 칭찬 한마디가 관계를 깊게 만들어줘요.', health: '규칙적인 식사가 체력 관리의 핵심입니다.', lucky: '행운의 색: 주황색 / 행운의 숫자: 3, 6' },
    { summary: '저축 습관을 돌아보기 좋은 날이에요. 매달 자동이체 되는 금액을 한번 점검해보세요. 소소한 금액이라도 꾸준히 모이면 큰 목돈이 됩니다. 장기적 안목이 중요해요.', money: '적립식 투자 금액을 소폭 늘려보는 것도 좋은 전략이에요.', love: '오래된 친구와의 만남이 마음에 위안을 줍니다.', health: '비타민이나 영양제 보충이 필요한 시기입니다.', lucky: '행운의 색: 연두 / 행운의 숫자: 1, 4' },
  ],
  '호랑이': [
    { summary: '에너지가 폭발하는 날! 미뤄뒀던 투자 결정을 내리기 좋습니다. 단, 감정적으로 움직이기보다 데이터를 한번 더 확인하고 실행에 옮기세요. 오후 3시 이후가 최적의 타이밍.', money: '성장주나 테마주에서 기회를 포착할 수 있어요. 분할매수 추천.', love: '리더십이 빛나는 날. 주변 사람들이 당신을 따를 거예요.', health: '격한 운동보다 요가나 필라테스가 더 효과적입니다.', lucky: '행운의 색: 빨간색 / 행운의 숫자: 1, 9' },
    { summary: '새로운 도전을 시작하기 최적의 날이에요. 부업, 사이드 프로젝트, 자격증 공부 등 평소 하고 싶었던 것을 오늘 첫걸음을 떼보세요. 시작이 반입니다.', money: '새로운 수입원을 만드는 것이 최고의 투자입니다.', love: '열정적인 에너지가 주변 사람들에게도 전염돼요.', health: '아침 운동이 하루 컨디션을 좌우합니다.', lucky: '행운의 색: 금색 / 행운의 숫자: 5, 7' },
    { summary: '경쟁 상황에서 우위를 점할 수 있는 날이에요. 청약이나 입찰 등 경쟁이 필요한 곳에서 좋은 결과를 기대해도 좋습니다. 자신감을 갖되 무모하지는 마세요.', money: '청약 가점 계산을 다시 해보세요. 의외의 결과가 나올 수 있어요.', love: '당당한 모습이 매력적으로 보이는 날이에요.', health: '과로에 주의. 적절한 휴식이 장기적 성과를 만듭니다.', lucky: '행운의 색: 주황 / 행운의 숫자: 3, 8' },
    { summary: '그동안 준비해온 일이 결실을 맺는 날입니다. 투자든 커리어든, 꾸준히 쌓아온 노력이 인정받는 순간이 올 거예요. 겸손하게 받아들이되 내심 뿌듯해해도 괜찮아요.', money: '수익 실현을 고려해도 좋은 타이밍이에요.', love: '성취를 함께 축하할 사람과의 시간을 만들어보세요.', health: '몸도 마음도 충전이 필요해요. 오늘은 일찍 쉬세요.', lucky: '행운의 색: 보라 / 행운의 숫자: 2, 6' },
  ],
  '토끼': [
    { summary: '감각이 예민해지는 날이에요. 부동산 매물을 직접 보러 다니면 의외로 좋은 물건을 발견할 수 있습니다. 인테리어나 리모델링에 대한 영감도 떠오를 수 있어요.', money: '실거주 목적의 부동산 탐색이 행운을 가져다줘요.', love: '가족을 위한 선물이 큰 감동을 줄 수 있는 날.', health: '알레르기에 주의하세요. 미세먼지 확인 필수.', lucky: '행운의 색: 분홍 / 행운의 숫자: 4, 7' },
    { summary: '창의적인 아이디어가 샘솟는 날! 투자 포트폴리오를 새로운 시각으로 바라보면 숨겨진 기회를 찾을 수 있어요. 남들과 다른 관점이 오히려 정답일 수 있습니다.', money: '잘 알려지지 않은 우량 중소형주에 주목해보세요.', love: '함께 문화생활을 즐기면 관계가 더 깊어져요.', health: '차 한 잔의 여유가 스트레스를 씻어줍니다.', lucky: '행운의 색: 연보라 / 행운의 숫자: 3, 9' },
    { summary: '자기계발에 투자하면 10배로 돌아오는 날이에요. 재테크 관련 책을 읽거나, 온라인 강의를 들어보세요. 오늘 배운 지식이 미래의 수익으로 연결됩니다.', money: '금융 문해력을 높이는 것이 최고의 투자입니다.', love: '지적인 대화가 상대방의 마음을 사로잡아요.', health: '눈의 피로를 풀어주세요. 블루라이트 차단 안경 추천.', lucky: '행운의 색: 흰색 / 행운의 숫자: 2, 8' },
    { summary: '조용히 내면을 들여다보는 시간이 필요한 날이에요. 번잡한 시장 소음에서 벗어나 나만의 투자 철학을 정리해보세요. 기본에 충실한 전략이 결국 승리합니다.', money: '현금 비중을 점검하고 비상자금을 확보해두세요.', love: '혼자만의 시간도 소중해요. 재충전의 시간을 가지세요.', health: '명상이나 심호흡이 정신 건강에 큰 도움이 됩니다.', lucky: '행운의 색: 아이보리 / 행운의 숫자: 1, 6' },
  ],
  '용': [
    { summary: '대범한 결정이 큰 수익으로 연결될 수 있는 날이에요. 하지만 무모한 베팅과 대담한 투자는 다릅니다. 철저한 분석 후 확신이 서면 과감히 움직이세요.', money: '대형 우량주나 글로벌 ETF에서 기회를 찾아보세요.', love: '자신감 넘치는 모습이 주변을 환하게 만들어줘요.', health: '충분한 수분 섭취가 활력의 비결이에요.', lucky: '행운의 색: 금색 / 행운의 숫자: 5, 9' },
    { summary: '사람들이 당신의 의견에 귀를 기울이는 날이에요. 투자 모임이나 커뮤니티에서 적극적으로 의견을 나눠보세요. 당신의 인사이트가 다른 사람에게도 도움이 됩니다.', money: '집단지성을 활용한 투자 판단이 좋은 결과를 가져와요.', love: '리더십과 포용력이 매력 포인트에요.', health: '성대 관리에 주의. 따뜻한 물을 자주 마시세요.', lucky: '행운의 색: 빨간색 / 행운의 숫자: 1, 8' },
    { summary: '야심찬 계획을 세우기에 최적의 날이에요. 1년 후, 3년 후의 재무 목표를 구체적으로 설정해보세요. 명확한 목표가 있으면 매일의 투자 결정이 쉬워집니다.', money: '장기 목표 수익률을 계산하고 역으로 필요한 투자액을 산출해보세요.', love: '파트너와 함께 미래를 설계하면 더 든든해요.', health: '체력이 자본! 꾸준한 운동 루틴을 만들어보세요.', lucky: '행운의 색: 보라 / 행운의 숫자: 3, 7' },
    { summary: '주변의 도움으로 예상치 못한 기회가 찾아오는 날이에요. 네트워킹 자리를 적극 활용하세요. 특히 선배 투자자의 경험담에서 귀중한 교훈을 얻을 수 있습니다.', money: '멘토의 조언을 참고하되 최종 결정은 스스로 내리세요.', love: '고마운 사람에게 진심 어린 감사를 전하세요.', health: '하루 만보 걷기가 최고의 보약이에요.', lucky: '행운의 색: 하늘색 / 행운의 숫자: 4, 6' },
  ],
  '뱀': [
    { summary: '직감이 극도로 날카로운 날이에요. 시장의 미세한 변화를 감지할 수 있는 능력이 최고조입니다. 차트를 분석할 때 평소 놓치던 패턴이 보일 수 있어요.', money: '기술적 분석에 기반한 트레이딩이 유리한 날.', love: '상대방의 진심을 꿰뚫어 볼 수 있는 날이에요.', health: '두뇌 활동이 활발해요. 견과류 등 브레인 푸드를 챙기세요.', lucky: '행운의 색: 검정 / 행운의 숫자: 2, 5' },
    { summary: '정보의 바다에서 핵심을 건져 올리는 능력이 빛나는 날이에요. 공시자료, 재무제표, 부동산 등기부 등 숫자 뒤에 숨겨진 진실을 찾을 수 있습니다.', money: '재무제표 분석에서 저평가된 기업을 발견할 수 있어요.', love: '깊은 대화가 관계를 한 단계 끌어올려줍니다.', health: '과도한 야근은 금물. 적절한 선에서 끊으세요.', lucky: '행운의 색: 진보라 / 행운의 숫자: 7, 9' },
    { summary: '조용히 준비하면 큰 성과를 거두는 날이에요. 남들에게 알리지 않고 혼자 리서치하는 시간이 가장 생산적일 겁니다. 시끄러운 시장 소음에 흔들리지 마세요.', money: '가치투자 관점에서 저평가 매물을 찾아보세요.', love: '말보다 행동으로 보여주세요. 진심이 통합니다.', health: '실내 공기 환기가 필요한 날이에요.', lucky: '행운의 색: 회색 / 행운의 숫자: 1, 3' },
    { summary: '학습과 성장에 최적화된 하루에요. 투자 관련 세미나나 웨비나에 참여하면 좋은 인사이트를 얻을 수 있어요. 새로운 투자 기법을 배워두면 미래에 큰 도움이 됩니다.', money: '세금 절약 전략을 공부하면 실질 수익률이 올라가요.', love: '지적 호기심을 공유할 수 있는 사람을 만나보세요.', health: '스트레칭으로 굳은 몸을 풀어주세요.', lucky: '행운의 색: 남색 / 행운의 숫자: 6, 8' },
  ],
  '말': [
    { summary: '에너지가 넘치고 행동력이 최고조인 날! 발품을 팔면 보상이 따라옵니다. 부동산 임장, 기업 탐방, 시장 조사 등 현장에서 느끼는 감각이 좋은 투자로 연결돼요.', money: '직접 발로 뛰는 투자가 최고의 수익을 가져와요.', love: '활기찬 에너지가 주변에 좋은 영향을 미칩니다.', health: '유산소 운동이 스트레스 해소에 딱이에요.', lucky: '행운의 색: 빨간색 / 행운의 숫자: 3, 5' },
    { summary: '네트워킹의 힘이 빛나는 날이에요. 다양한 사람들과 만나 정보를 교환하면 놀라운 기회를 발견할 수 있어요. 점심 약속이나 저녁 모임에 적극 참여하세요.', money: '인맥에서 얻는 정보가 수익으로 직결되는 날.', love: '새로운 만남에서 특별한 인연을 만날 수 있어요.', health: '과음 주의! 건강한 음료로 건배하세요.', lucky: '행운의 색: 주황 / 행운의 숫자: 7, 9' },
    { summary: '빠른 의사결정이 요구되는 상황이 올 수 있어요. 당황하지 말고 평소 세워둔 원칙에 따라 판단하세요. 당신의 순발력이 빛을 발할 겁니다.', money: '단기 트레이딩에서 좋은 수익을 올릴 수 있어요.', love: '스피드 있는 진행이 상대방의 호감을 사요.', health: '관절에 무리가 가지 않도록 주의하세요.', lucky: '행운의 색: 초록 / 행운의 숫자: 1, 4' },
    { summary: '자유로운 발상이 떠오르는 날이에요. 기존의 틀에서 벗어나 새로운 투자 카테고리를 탐색해보세요. 해외 주식, 암호화폐, 대체 투자 등 시야를 넓혀보세요.', money: '글로벌 분산투자의 매력을 느낄 수 있는 날.', love: '자유를 존중하는 관계가 가장 오래가요.', health: '야외 활동이 비타민D 보충에 좋아요.', lucky: '행운의 색: 하늘색 / 행운의 숫자: 2, 8' },
  ],
  '양': [
    { summary: '따뜻한 마음이 좋은 투자를 만드는 날이에요. ESG 투자나 사회적 기업에 관심을 가져보세요. 착한 투자가 착한 수익으로 돌아옵니다. 주변과 나누는 마음이 중요해요.', money: 'ESG ETF나 친환경 관련주에 주목해보세요.', love: '작은 배려가 큰 감동을 만들어줘요.', health: '명상이나 요가가 마음의 안정을 줍니다.', lucky: '행운의 색: 연분홍 / 행운의 숫자: 2, 6' },
    { summary: '안정적인 포트폴리오가 마음의 평화를 주는 날이에요. 변동성이 큰 종목보다 꾸준히 배당을 주는 우량주가 더 빛납니다. 마음이 편해야 좋은 판단을 할 수 있어요.', money: '고배당주나 채권형 펀드로 안정적인 수익을 추구하세요.', love: '편안한 대화가 가장 큰 힐링이에요.', health: '따뜻한 차 한 잔이 하루를 마무리해줍니다.', lucky: '행운의 색: 아이보리 / 행운의 숫자: 4, 8' },
    { summary: '부동산 시장에서 눈여겨볼 물건이 있는 날이에요. 전세 갭이 적은 매물이나 역세권 소형 아파트를 중심으로 탐색해보세요. 실거주와 투자를 겸할 수 있는 기회.', money: '전세가율이 높은 지역의 소형 아파트를 체크해보세요.', love: '가정의 평화가 투자 성과의 기반이에요.', health: '정원 가꾸기나 식물 돌보기가 힐링이 됩니다.', lucky: '행운의 색: 연두 / 행운의 숫자: 3, 7' },
    { summary: '주변 사람들과 함께 성장하는 날이에요. 투자 스터디나 독서 모임에 참여하면 새로운 관점을 얻을 수 있어요. 혼자보다 함께할 때 더 큰 시너지가 납니다.', money: '투자 스터디 그룹에서 좋은 아이디어를 얻을 수 있어요.', love: '공동의 목표가 관계를 더 단단하게 만들어줘요.', health: '사회적 교류가 정신 건강에 가장 좋은 약이에요.', lucky: '행운의 색: 하늘색 / 행운의 숫자: 5, 9' },
  ],
  '원숭이': [
    { summary: '기발한 아이디어가 쏟아지는 날! 남들이 주목하지 않는 곳에서 기회를 찾을 수 있어요. IT, AI, 핀테크 등 혁신적인 분야의 기업을 눈여겨보세요.', money: 'AI/반도체 관련주에서 단기 기회를 포착할 수 있어요.', love: '유머러스한 대화가 관계의 윤활유가 됩니다.', health: '두뇌 운동이 필요해요. 퍼즐이나 독서를 추천.', lucky: '행운의 색: 노란색 / 행운의 숫자: 1, 5' },
    { summary: '숫자에 유독 강한 날이에요. 재무 분석이 정확하고 계산이 빠릅니다. 스프레드시트를 펼치고 포트폴리오 수익률을 다시 계산해보세요. 숨겨진 비효율을 발견할 수 있어요.', money: '수수료, 세금 등 숨은 비용을 점검하면 실질 수익률이 올라가요.', love: '센스 있는 서프라이즈가 감동을 선사해요.', health: '손목 스트레칭을 자주 해주세요. 키보드 사용이 많은 날.', lucky: '행운의 색: 주황 / 행운의 숫자: 6, 9' },
    { summary: '멀티태스킹 능력이 빛나는 날이에요. 여러 가지 투자를 동시에 관리하면서도 실수 없이 처리할 수 있어요. 부업이나 사이드 프로젝트를 추진하기에도 좋은 날.', money: '소규모 부업에서 의외의 수입원을 발견할 수 있어요.', love: '재미있는 대화가 관계를 풍성하게 만들어요.', health: '멀티태스킹에도 에너지 관리가 필요해요. 영양보충 챙기세요.', lucky: '행운의 색: 연두 / 행운의 숫자: 3, 7' },
    { summary: '변화와 적응의 날이에요. 시장 환경이 바뀌어도 유연하게 대응할 수 있는 능력이 당신의 강점입니다. 고정관념을 버리고 새로운 트렌드에 빠르게 올라타세요.', money: '트렌드를 빨리 읽는 것이 수익의 핵심이에요.', love: '변화를 두려워하지 마세요. 새로운 시작이 기다려요.', health: '스트레칭과 가벼운 운동으로 유연성을 키우세요.', lucky: '행운의 색: 민트 / 행운의 숫자: 2, 8' },
  ],
  '닭': [
    { summary: '꼼꼼한 분석력이 빛나는 날이에요. 다른 사람들이 대충 넘기는 공시자료나 재무제표에서 핵심을 짚어낼 수 있어요. 디테일이 차이를 만드는 법, 오늘 그 진가를 확인하세요.', money: '기업 실적 분석에 시간을 투자하면 큰 보답이 있어요.', love: '세심한 배려가 상대방의 마음을 사로잡아요.', health: '규칙적인 생활이 최고의 건강법이에요.', lucky: '행운의 색: 흰색 / 행운의 숫자: 4, 8' },
    { summary: '아침형 인간의 이점을 최대한 활용하세요. 장 시작 전 30분의 리서치가 하루 수익을 좌우합니다. 일찍 일어나 차분하게 시장을 분석하고 전략을 세워보세요.', money: '프리마켓 동향 체크가 오늘의 투자 성과를 결정해요.', love: '아침 인사가 하루를 밝게 만들어줘요.', health: '아침 공복 운동이 몸의 리듬을 잡아줍니다.', lucky: '행운의 색: 금색 / 행운의 숫자: 1, 6' },
    { summary: '절약과 저축의 미덕이 빛나는 날이에요. 불필요한 소비를 줄이고 그 돈을 투자로 돌리는 습관이 장기적으로 엄청난 차이를 만듭니다.', money: '가계부 정리를 해보세요. 새는 돈을 막는 것도 수익이에요.', love: '소박하지만 정성 어린 데이트가 최고에요.', health: '식단 관리가 건강의 기본이에요. 단백질 보충 추천.', lucky: '행운의 색: 갈색 / 행운의 숫자: 3, 5' },
    { summary: '체계적인 계획 수립이 빛나는 날이에요. 월간/분기별/연간 투자 계획을 세워보세요. 구체적인 목표와 실행 계획이 있으면 흔들리지 않는 투자를 할 수 있습니다.', money: '투자 일지를 작성하면 패턴을 발견할 수 있어요.', love: '약속을 잘 지키는 사람이 가장 매력적이에요.', health: '수면 시간을 일정하게 유지하세요.', lucky: '행운의 색: 베이지 / 행운의 숫자: 7, 9' },
  ],
  '개': [
    { summary: '신뢰가 자산이 되는 날이에요. 오랫동안 거래해 온 증권사 PB나 부동산 중개사에게 연락해보세요. 신뢰 관계에서만 나오는 좋은 매물이나 정보를 얻을 수 있어요.', money: '신뢰할 수 있는 전문가의 조언에 귀 기울이세요.', love: '진심을 다하는 사람에게 좋은 일이 찾아와요.', health: '산책을 하면서 복잡한 생각을 정리해보세요.', lucky: '행운의 색: 갈색 / 행운의 숫자: 2, 5' },
    { summary: '보험, 연금 등 안전망을 점검하기 좋은 날이에요. 투자에만 집중하다 보면 기본적인 리스크 관리를 소홀히 하기 쉬워요. 오늘 한번 꼼꼼히 체크해보세요.', money: '연금저축이나 IRP 등 절세 상품을 점검하세요.', love: '가족의 건강과 안전이 최우선이에요.', health: '정기 건강검진 날짜를 잡아보세요.', lucky: '행운의 색: 파란색 / 행운의 숫자: 3, 8' },
    { summary: '안정적인 투자가 마음의 평화를 주는 날이에요. 변동성이 큰 종목에서 스트레스 받기보다 국채, 우량 채권형 펀드 등으로 마음을 편하게 가지세요.', money: '예적금 금리를 비교해보세요. 고금리 특판이 있을 수 있어요.', love: '안정감 있는 사람이 가장 매력적이에요.', health: '따뜻한 목욕이 하루의 피로를 풀어줍니다.', lucky: '행운의 색: 초록 / 행운의 숫자: 1, 7' },
    { summary: '봉사나 기부를 통해 마음의 풍요를 느낄 수 있는 날이에요. 직접적인 금전 수익은 아니지만, 사회에 환원하는 마음이 장기적으로 더 큰 행운을 가져다 줍니다.', money: '기부금 세액공제를 활용하면 절세 효과도 있어요.', love: '함께 봉사 활동을 하면 관계가 더 깊어져요.', health: '남을 돕는 행위가 자신의 건강에도 긍정적이에요.', lucky: '행운의 색: 노란색 / 행운의 숫자: 4, 9' },
  ],
  '돼지': [
    { summary: '풍요와 행운의 기운이 가득한 날이에요! 평소보다 금전적으로 좋은 일이 생길 수 있어요. 보너스, 환급금, 예상치 못한 수입 등 기분 좋은 소식이 찾아올 수 있습니다.', money: '여윳돈이 생기면 즉시 투자에 활용해보세요.', love: '풍요로운 마음이 주변을 환하게 만들어줘요.', health: '맛있는 음식을 적당히 즐기세요. 과식은 금물!', lucky: '행운의 색: 금색 / 행운의 숫자: 5, 8' },
    { summary: '가족과 함께 재정 계획을 세우기 좋은 날이에요. 자녀 교육비, 노후 자금, 여행 계획 등을 함께 논의하면 서로의 우선순위를 이해하고 더 나은 계획을 세울 수 있어요.', money: '가족 재정 회의를 열어보세요. 같은 방향을 바라보는 것이 중요해요.', love: '솔직한 대화가 가장 깊은 유대감을 만들어요.', health: '가족과 함께 하는 산책이 최고의 운동이에요.', lucky: '행운의 색: 분홍 / 행운의 숫자: 2, 7' },
    { summary: '맛있는 음식과 함께 좋은 기운을 충전하는 날이에요. 비즈니스 미팅이나 투자 모임을 식사 자리로 잡으면 더 좋은 결과가 나올 수 있어요. 분위기가 성사율을 높여줍니다.', money: '식사 자리에서 나온 정보가 의외로 가치 있을 수 있어요.', love: '함께 맛집을 찾아다니면 즐거움이 배가 돼요.', health: '과식과 과음에만 주의하면 건강한 하루!', lucky: '행운의 색: 주황 / 행운의 숫자: 3, 6' },
    { summary: '여유로운 마음으로 투자를 바라보는 날이에요. 조급함을 내려놓고 장기적인 안목으로 시장을 관찰하세요. 여유가 있어야 기회가 보이는 법. 인내가 곧 수익입니다.', money: '급하게 사고팔지 마세요. 기다림의 미학을 실천하세요.', love: '느긋한 시간이 관계에 여유를 줍니다.', health: '온천이나 목욕이 몸과 마음을 충전해줘요.', lucky: '행운의 색: 연보라 / 행운의 숫자: 1, 4' },
  ],
};

function DailyFortune() {
  const [year, setYear] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const { userId } = useAuth();

  // DB 우선 → localStorage 폴백
  useEffect(() => {
    (async () => {
      // 1. 로그인 유저 → DB에서 birth_year 읽기
      if (userId) {
        try {
          const { createSupabaseBrowser } = await import('@/lib/supabase-browser');
          const sb = createSupabaseBrowser();
          const { data } = await sb.from('profiles').select('birth_year').eq('id', userId).maybeSingle();
          if (data?.birth_year) {
            setYear(data.birth_year);
            localStorage.setItem('kd_birth_year', String(data.birth_year));
            return;
          }
        } catch {}
      }
      // 2. 폴백: localStorage
      const s = localStorage.getItem('kd_birth_year');
      if (s) setYear(parseInt(s));
    })();
  }, [userId]);
  const now = new Date();
  const seed = now.getFullYear() * 366 + (now.getMonth() + 1) * 31 + now.getDate();
  const getZ = (y: number) => ZA[(y - 4) % 12 >= 0 ? (y - 4) % 12 : (y - 4) % 12 + 12];
  const getFortune = (animal: string): FortuneDetail => {
    const arr = ZF[animal] || ZF['쥐'];
    return arr[seed % arr.length];
  };

  const handleSelect = (y: number) => {
    setYear(y);
    localStorage.setItem('kd_birth_year', String(y));
    const animal = getZ(y);
    const fortune = getFortune(animal);
    // DB 저장 (로그인 유저만 저장됨, 비로그인은 서버에서 무시)
    fetch('/api/fortune', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth_year: y, zodiac_animal: animal, fortune_text: fortune.summary }),
    }).catch(() => {});
  };

  // 이미 선택 후 오늘 첫 로드 시 자동 DB 저장
  useEffect(() => {
    if (year && !saved) {
      setSaved(true);
      const animal = getZ(year);
      const fortune = getFortune(animal);
      fetch('/api/fortune', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birth_year: year, zodiac_animal: animal, fortune_text: fortune.summary }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  if (!year) return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>출생연도를 선택하면 오늘의 띠별 운세를 확인할 수 있어요</div>
      <select onChange={e => handleSelect(parseInt(e.target.value))}
        style={{ width: '100%', padding: '8px 10px', fontSize: 13, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer' }}>
        <option value="">출생연도 선택</option>
        {Array.from({ length: 60 }, (_, i) => 2006 - i).map(y => <option key={y} value={y}>{y}년 ({ZE[getZ(y)]} {getZ(y)}띠)</option>)}
      </select>
    </div>
  );

  const animal = getZ(year);
  const f = getFortune(animal);
  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 10 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{ZE[animal]}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{animal}띠 · {year}년생</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{now.getMonth() + 1}월 {now.getDate()}일 운세</div>
          </div>
        </div>
        <button onClick={() => { setYear(null); setSaved(false); localStorage.removeItem('kd_birth_year'); }} style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer' }}>변경</button>
      </div>

      {/* 종합 운세 */}
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, marginBottom: 12, padding: '10px 12px', background: 'rgba(59,123,246,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,123,246,0.08)' }}>
        {f.summary}
      </div>

      {/* 세부 운세 — 4항목 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        {[
          { icon: '💰', label: '금전운', text: f.money },
          { icon: '💕', label: '애정운', text: f.love },
          { icon: '💪', label: '건강운', text: f.health },
          { icon: '🍀', label: '행운', text: f.lucky },
        ].map(item => (
          <div key={item.label} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{item.icon}</span> {item.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  data: DailyReportData;
  regions: string[];
  viewDate?: string | null;   // 아카이브 모드 (null = 오늘 실시간)
  prevDate?: string | null;
  nextDate?: string | null;
}

function fmt(n: number) { return n >= 10000 ? (n / 10000).toFixed(1) + '억' : n.toLocaleString() + '만'; }
function fmtB(n: number) { return n >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(0) + 'B' : n.toLocaleString(); }
function pctColor(v: number | null) { return !v ? 'var(--text-tertiary)' : v > 0 ? 'var(--accent-red)' : 'var(--text-brand)'; }
function pctStr(v: number | null) { return v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }

// VIP Gold 컬러 팔레트
const G = {
  gold: '#D4A853',
  goldLight: '#E8C778',
  goldDark: '#B8942E',
  goldBg: 'rgba(212,168,83,0.06)',
  goldBorder: 'rgba(212,168,83,0.18)',
  goldGlow: 'rgba(212,168,83,0.12)',
  gradientBorder: 'linear-gradient(135deg, rgba(212,168,83,0.4) 0%, rgba(184,148,46,0.15) 50%, rgba(212,168,83,0.4) 100%)',
  gradientHero: 'linear-gradient(145deg, var(--bg-surface) 0%, rgba(212,168,83,0.04) 40%, var(--bg-surface) 100%)',
};

const SH = ({ icon, title }: { icon: string; title: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', margin: '20px 0 10px' }}>
    <div style={{ width: 3, height: 18, borderRadius: 4, background: `linear-gradient(180deg, ${G.gold} 0%, ${G.goldDark} 100%)` }} />
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{title}</span>
  </div>
);

export default function DailyReportClient({ data, regions, viewDate, prevDate, nextDate }: Props) {
  const router = useRouter();
  const { userId, profile, loading: authLoading } = useAuth();
  const d = data;
  const isArchive = !!viewDate;

  const displayDate = viewDate ? new Date(viewDate) : new Date();
  const now = displayDate; // 체크포인트 계산용
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${displayDate.getFullYear()}.${String(displayDate.getMonth() + 1).padStart(2, '0')}.${String(displayDate.getDate()).padStart(2, '0')} ${dayNames[displayDate.getDay()]}`;

  const localUnsoldUnits = d.unsoldLocal.reduce((s, r) => s + r.units, 0);
  const localUnsoldPct = d.unsoldUnits > 0 ? Math.round(localUnsoldUnits / d.unsoldUnits * 1000) / 10 : 0;

  // 섹터: 상승/하락 카운트
  const sectorUp = d.sectors.filter(s => s.avg_pct > 0).length;
  const sectorDn = d.sectors.filter(s => s.avg_pct <= 0).length;

  // TOP 10 주간 상승/하락 카운트
  const weekUp = d.stockTop10.filter(s => (s.week_pct ?? 0) > 0).length;
  const weekDn = d.stockTop10.filter(s => (s.week_pct ?? 0) < 0).length;

  const maxGu = d.guPrices[0]?.sale || 1;

  // 날짜 네비게이션 핸들러
  const goToDate = (date: string) => router.push(`/daily/${encodeURIComponent(d.region)}/${date}`);
  const goToToday = () => router.push(`/daily/${encodeURIComponent(d.region)}`);
  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) goToDate(e.target.value);
  };

  // ═══ 공유 1회 게이트 (공유 완료 시 영구 무료 열람) ═══
  const [shareUnlocked, setShareUnlocked] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    // localStorage에서 공유 완료 여부 확인
    try {
      const unlocked = localStorage.getItem('kd_report_unlocked');
      if (unlocked === 'true') setShareUnlocked(true);
    } catch {}
  }, []);

  const handleShareUnlock = async () => {
    setShareLoading(true);
    const shareUrl = `${window.location.origin}/daily/${encodeURIComponent(d.region)}`;
    const shareTitle = `카더라 데일리 리포트 — ${d.region} 투자 브리핑`;
    const shareText = `${d.region} 부동산·주식 시황을 매일 한 장에 정리! 청약 ${d.subCountThisWeek}건 · 미분양 ${d.unsoldUnits.toLocaleString()}세대`;

    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        shared = true;
      } catch { /* 사용자가 취소해도 OK */ }
    }
    if (!shared) {
      try {
        await navigator.clipboard.writeText(`${shareTitle}\n${shareUrl}`);
        shared = true;
      } catch {}
    }

    if (shared) {
      setShareUnlocked(true);
      try { localStorage.setItem('kd_report_unlocked', 'true'); } catch {}
      // DB 기록 (로그인 유저)
      if (userId) {
        fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: `daily-${d.region}`, platform: typeof navigator.share === 'function' ? 'native' : 'clipboard' }),
        }).catch(() => {});
      }
    }
    setShareLoading(false);
  };

  const isGated = !shareUnlocked && !authLoading;
  const gateReason = !userId ? 'login' : 'share';

  if (isGated) {
    return (
      <div>
        {/* 공유 1회 게이트 */}
        <div style={{
          padding: '28px 20px', borderRadius: 'var(--radius-card)',
          background: G.gradientHero, border: `1.5px solid ${G.goldBorder}`,
          position: 'relative', overflow: 'hidden', textAlign: 'center',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G.goldDark}, ${G.gold}, ${G.goldLight}, ${G.gold}, ${G.goldDark})` }} />

          {/* 아이콘 */}
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>

          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            카더라 데일리 리포트
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
            매일 아침 <b style={{ color: G.gold }}>{d.region}</b> 부동산·주식 시황을 한 장에 정리한 투자 브리핑입니다.
          </div>

          {/* 공유 혜택 설명 */}
          <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)', background: G.goldBg, border: `1px solid ${G.goldBorder}`, marginBottom: 16, textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.gold, marginBottom: 8, textAlign: 'center' }}>🔓 리포트 무료 열람 방법</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>1️⃣</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>아래 <b style={{ color: 'var(--text-primary)' }}>공유하기</b> 버튼을 눌러 카카오톡, 밴드 등 아무 곳에나 <b style={{ color: G.gold }}>1회</b> 공유해 주세요</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>2️⃣</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>공유 완료 즉시 리포트가 열리며, <b style={{ color: 'var(--accent-green)' }}>앞으로 영구 무료</b>로 매일 읽을 수 있어요</span>
              </div>
            </div>
          </div>

          {/* 공유 버튼 */}
          <button
            onClick={handleShareUnlock}
            disabled={shareLoading}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 'var(--radius-xl)', border: 'none',
              background: `linear-gradient(135deg, ${G.gold}, ${G.goldDark})`, color: '#fff',
              fontSize: 'var(--fs-base)', fontWeight: 800, cursor: shareLoading ? 'wait' : 'pointer',
              boxShadow: `0 4px 16px rgba(212,168,83,0.35)`,
              opacity: shareLoading ? 0.7 : 1, transition: 'opacity 0.15s',
            }}
          >
            {shareLoading ? '공유 중...' : '📤 공유하고 리포트 보기'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
            ✦ 단 1번 공유로 평생 무료 · 공유 대상은 자유 · 나에게 보내기도 OK
          </p>

          {/* 미리보기 힌트 */}
          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: `1px solid ${G.goldBorder}` }}>
            <div style={{ fontSize: 11, color: G.gold, fontWeight: 600, marginBottom: 4 }}>✦ 오늘 리포트 미리보기</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              {dateLabel} · #{d.issueNo}호 · {d.region} 투자 브리핑<br/>
              시총 TOP 10 · 섹터 히트맵 · 청약 {d.subCountThisWeek}건 · 미분양 {d.unsoldUnits.toLocaleString()}세대
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 아카이브 모드 배너 */}
      {isArchive && (
        <div style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}`, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: G.gold }}>📂 {viewDate} 아카이브</span>
          <button onClick={goToToday} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: G.gold, background: 'none', border: `1px solid ${G.goldBorder}`, borderRadius: 'var(--radius-xs)', padding: '3px 10px', cursor: 'pointer' }}>오늘 보기 →</button>
        </div>
      )}

      {/* ═══ HERO — 회원전용 Premium ═══ */}
      <div style={{
        padding: '18px 16px', borderRadius: 'var(--radius-card)',
        background: G.gradientHero,
        border: `1px solid ${G.goldBorder}`,
        marginBottom: 'var(--sp-sm)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 데코 골드 라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 0%, ${G.gold} 30%, ${G.goldLight} 50%, ${G.gold} 70%, transparent 100%)` }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: G.gold, letterSpacing: 1.5, textTransform: 'uppercase' }}>KADEORA DAILY REPORT</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', background: G.goldBg, padding: '3px 8px', borderRadius: 4, border: `1px solid ${G.goldBorder}` }}>#{d.issueNo}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, marginBottom: 4 }}>
              {(() => {
                const h = new Date().getHours();
                const greeting = h < 12 ? '좋은 아침이에요' : h < 18 ? '오후도 파이팅' : '오늘 하루 수고하셨어요';
                return isArchive ? '투자 브리핑 아카이브' : `${greeting} 👋`;
              })()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {dateLabel} · {d.region} 투자 브리핑
            </div>
          </div>
          <select
            value={d.region}
            onChange={async (e) => {
              const newRegion = e.target.value;
              const base = `/daily/${encodeURIComponent(newRegion)}`;
              // localStorage 동기화
              localStorage.setItem('daily_region', newRegion);
              // DB 동기화 (로그인 유저)
              try {
                const { createSupabaseBrowser } = await import('@/lib/supabase-browser');
                const sb = createSupabaseBrowser();
                const { data: { user } } = await sb.auth.getUser();
                if (user) {
                  await sb.from('profiles').update({
                    residence_city: newRegion,
                    region_text: newRegion,
                    updated_at: new Date().toISOString(),
                  }).eq('id', user.id);
                }
              } catch {}
              router.push(viewDate ? `${base}/${viewDate}` : base);
            }}
            style={{ fontSize: 12, fontWeight: 700, color: G.gold, background: G.goldBg, border: `1px solid ${G.goldBorder}`, borderRadius: 'var(--radius-xs)', padding: '4px 10px', cursor: 'pointer' }}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* 리포트 소개 */}
        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: `1px solid ${G.goldBorder}`, marginBottom: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
            📊 이 리포트는 <b style={{ color: 'var(--text-primary)' }}>{d.region}</b> 지역 부동산(청약·미분양·재개발·실거래) + 국내외 주식 시황을 매일 아침 자동으로 수집·분석하여 한 장에 정리한 <b style={{ color: G.gold }}>투자 브리핑</b>입니다.
            {d.subCountThisWeek > 0 && <> 이번주 청약 <b>{d.subCountThisWeek}건({d.subUnitsThisWeek.toLocaleString()}세대)</b> 예정.</>}
          </p>
        </div>

        {/* 날짜 네비게이션 — 골드 라인 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${G.goldBorder}`, marginBottom: 6 }}>
          <button
            onClick={() => prevDate && goToDate(prevDate)}
            disabled={!prevDate}
            style={{ fontSize: 12, fontWeight: 700, color: prevDate ? G.gold : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: prevDate ? 'pointer' : 'default', padding: '4px 8px' }}
          >◀ 이전</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{dateLabel}</span>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <input
                type="date"
                onChange={handleDateInput}
                defaultValue={viewDate || undefined}
                max={new Date().toISOString().slice(0, 10)}
                min="2026-01-06"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
            </label>
          </div>

          <button
            onClick={() => nextDate ? goToDate(nextDate) : (!isArchive ? undefined : goToToday())}
            disabled={!nextDate && !isArchive}
            style={{ fontSize: 12, fontWeight: 700, color: (nextDate || isArchive) ? G.gold : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: (nextDate || isArchive) ? 'pointer' : 'default', padding: '4px 8px' }}
          >{nextDate ? '다음 ▶' : isArchive ? '오늘 ▶' : '최신'}</button>
        </div>

        {/* ═══ AI 투자 브리핑 첫줄 — 300자 요약 ═══ */}
        {d.aiBriefing && (
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(59,123,246,0.04)', border: '1px solid rgba(59,123,246,0.12)', marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              💬 {d.aiBriefing.summary.slice(0, 300)}
            </div>
          </div>
        )}

        {/* ═══ 오늘의 운세 (히어로 바로 아래) ═══ */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>🔮</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 운세</span>
          </div>
          <DailyFortune />
        </div>

        {/* 어젯밤 달라진 것 — 골드 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}`, marginBottom: 'var(--sp-sm)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: G.gold, marginBottom: 'var(--sp-xs)' }}>✦ 어젯밤 달라진 것</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-xs)' }}>
            {d.stockTop10.slice(0, 4).filter(s => s.week_pct != null && s.week_pct !== 0).map(s => (
              <span key={s.symbol} style={{
                fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                background: (s.week_pct ?? 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                color: pctColor(s.week_pct),
              }}>
                {s.name} {pctStr(s.week_pct)}/주
              </span>
            ))}
            {d.subscriptions.filter(s => s.status === '예정' && s.rcept_bgnde === d.date).map(s => (
              <span key={s.house_nm} style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)', background: 'rgba(251,146,60,0.08)', color: 'var(--accent-yellow)' }}>
                {s.house_nm.slice(0, 10)} 오늘 접수시작
              </span>
            ))}
          </div>
        </div>

        {/* 리포트 요약 설명 */}
        <div className="report-summary" style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>📋 오늘의 핵심 요약</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
            {d.region} 지역 {d.subCountThisWeek > 0 ? `이번주 청약 ${d.subCountThisWeek}건(${d.subUnitsThisWeek.toLocaleString()}세대)` : '이번주 예정 청약 없음'}
            {' · '}전국 미분양 {d.unsoldUnits.toLocaleString()}세대
            {d.redevTotal > 0 ? ` · ${d.region} 재개발 ${d.redevTotal}건 진행중` : ''}
            {d.stockTop10.length > 0 ? ` · 시총 TOP ${d.stockTop10[0]?.name} ${pctStr(d.stockTop10[0]?.change_pct)}` : ''}
          </p>
        </div>

        {/* KPI 스트립 */}
        <div className="kd-kpi-5">
          {[
            { v: d.subCountThisWeek + '건', l: '이번주 청약', s: d.subUnitsThisWeek.toLocaleString() + '세대', sc: 'var(--text-secondary)' },
            { v: d.unsoldUnits.toLocaleString(), l: '전국 미분양', s: `${d.region} ${localUnsoldPct}%`, sc: localUnsoldPct < 5 ? 'var(--accent-green)' : 'var(--accent-red)' },
            { v: d.redevTotal + '건', l: `${d.region} 재개발`, s: `재건축 ${d.redevRebuild}`, sc: 'var(--text-tertiary)' },
            { v: (sectorUp > sectorDn ? '+' : '') + d.sectors[0]?.avg_pct + '%', l: d.sectors[0]?.sector || '', s: sectorUp + '↑ ' + sectorDn + '↓', sc: 'var(--text-secondary)' },
            { v: d.guPrices[0] ? fmt(d.guPrices[0].sale) : '-', l: d.guPrices[0]?.sigungu + ' 매매', s: '전세율 ' + (d.guPrices[0]?.jeonse_ratio || '-') + '%', sc: 'var(--text-secondary)' },
          ].map((k, i) => (
            <div key={i} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '10px 6px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: G.goldLight }}>{k.v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{k.l}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.sc, marginTop: 1 }}>{k.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ NEW: AI 시장 브리핑 ═══ */}
      {(d.aiBriefing || d.aiBriefingUS) && (
        <>
          <SH icon="🤖" title="AI 시장 브리핑" />
          <div style={{ display: 'grid', gridTemplateColumns: d.aiBriefing && d.aiBriefingUS ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
            {d.aiBriefing && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>🇰🇷 국내</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                    background: d.aiBriefing.sentiment === 'bullish' ? 'rgba(239,68,68,0.08)' : d.aiBriefing.sentiment === 'bearish' ? 'rgba(59,130,246,0.08)' : G.goldBg,
                    color: d.aiBriefing.sentiment === 'bullish' ? 'var(--accent-red)' : d.aiBriefing.sentiment === 'bearish' ? 'var(--accent-blue)' : G.gold,
                  }}>{d.aiBriefing.sentiment === 'bullish' ? '📈 강세' : d.aiBriefing.sentiment === 'bearish' ? '📉 약세' : '➡️ 중립'}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{d.aiBriefing.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{d.aiBriefing.summary.slice(0, 200)}</div>
              </div>
            )}
            {d.aiBriefingUS && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>🇺🇸 해외</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                    background: d.aiBriefingUS.sentiment === 'bullish' ? 'rgba(16,185,129,0.08)' : d.aiBriefingUS.sentiment === 'bearish' ? 'rgba(239,68,68,0.08)' : G.goldBg,
                    color: d.aiBriefingUS.sentiment === 'bullish' ? 'var(--accent-green)' : d.aiBriefingUS.sentiment === 'bearish' ? 'var(--accent-red)' : G.gold,
                  }}>{d.aiBriefingUS.sentiment === 'bullish' ? '📈 강세' : d.aiBriefingUS.sentiment === 'bearish' ? '📉 약세' : '➡️ 중립'}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{d.aiBriefingUS.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{d.aiBriefingUS.summary.slice(0, 200)}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ NEW: 시장 심리 지수 ═══ */}
      {d.marketSentiment && (d.marketSentiment.positive + d.marketSentiment.negative + d.marketSentiment.neutral) > 0 && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '16px', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>🌡️ 시장 심리 지수</div>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: d.marketSentiment.score >= 60 ? '#22C55E' : d.marketSentiment.score <= 40 ? '#EF4444' : 'var(--text-secondary)' }}>
              {d.marketSentiment.score}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 4 }}>/ 100</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: d.marketSentiment.score >= 70 ? '#22C55E' : d.marketSentiment.score >= 55 ? '#86EFAC' : d.marketSentiment.score >= 45 ? 'var(--text-tertiary)' : d.marketSentiment.score >= 30 ? '#FCA5A5' : '#EF4444', marginTop: 4 }}>
              {d.marketSentiment.score >= 70 ? '🟢 탐욕' : d.marketSentiment.score >= 55 ? '🟡 낙관' : d.marketSentiment.score >= 45 ? '⚪ 중립' : d.marketSentiment.score >= 30 ? '🟠 불안' : '🔴 공포'}
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${d.marketSentiment.score}%`, borderRadius: 4, background: `linear-gradient(90deg, #EF4444, #F59E0B, #22C55E)`, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
            <span>극도의 공포</span><span>중립</span><span>극도의 탐욕</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#22C55E' }}>긍정 {d.marketSentiment.positive}건</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>중립 {d.marketSentiment.neutral}건</span>
            <span style={{ fontSize: 11, color: '#EF4444' }}>부정 {d.marketSentiment.negative}건</span>
          </div>
        </div>
      )}

      {/* ═══ NEW: 가격 변동 TOP ═══ */}
      {(d.priceChanges.stockUp.length > 0 || d.priceChanges.aptUp.length > 0) && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '16px', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>📊 오늘의 가격 변동 TOP</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* 주식 급등 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 6 }}>🔴 급등 종목</div>
              {d.priceChanges.stockUp.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.name}</span>
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>+{s.change_pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            {/* 주식 급락 */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 6 }}>🔵 급락 종목</div>
              {d.priceChanges.stockDown.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.name}</span>
                  <span style={{ color: '#3B82F6', fontWeight: 700 }}>{s.change_pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* 부동산 급등/급락 */}
          {d.priceChanges.aptUp.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 6 }}>🏠 시세 상승 단지</div>
                  {d.priceChanges.aptUp.map((a, i) => (
                    <div key={i} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>{a.sigungu}</span>
                        <span style={{ color: '#EF4444', fontWeight: 700 }}>+{a.change_pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 6 }}>🏠 시세 하락 단지</div>
                  {d.priceChanges.aptDown.map((a, i) => (
                    <div key={i} style={{ fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>{a.sigungu}</span>
                        <span style={{ color: '#3B82F6', fontWeight: 700 }}>{a.change_pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ NEW: 커뮤니티 핫토픽 ═══ */}
      {(d.hotTopics.polls.length > 0 || d.hotTopics.vsBattles.length > 0 || d.hotTopics.hotPosts.length > 0) && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '16px', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>🔥 커뮤니티 핫토픽</div>
          {/* VS 배틀 */}
          {d.hotTopics.vsBattles.map((v, i) => (
            <div key={`vs-${i}`} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8B5CF6', marginBottom: 4 }}>⚔️ VS 배틀 ({v.total}명 참여)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v.option_a}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: v.a_pct >= v.b_pct ? '#EF4444' : 'var(--text-tertiary)' }}>{v.a_pct}%</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)' }}>VS</div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v.option_b}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: v.b_pct >= v.a_pct ? '#3B82F6' : 'var(--text-tertiary)' }}>{v.b_pct}%</div>
                </div>
              </div>
            </div>
          ))}
          {/* 예측 */}
          {d.hotTopics.predictions.map((p, i) => (
            <div key={`pred-${i}`} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', marginBottom: 4 }}>🔮 예측 ({p.total}명 참여)</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', marginTop: 6 }}>
                <div style={{ height: '100%', width: `${p.agree_pct}%`, borderRadius: 4, background: '#F59E0B' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                <span>동의 {p.agree_pct}%</span><span>반대 {100 - p.agree_pct}%</span>
              </div>
            </div>
          ))}
          {/* 인기글 */}
          {d.hotTopics.hotPosts.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 4 }}>🔥 인기글</div>
              {d.hotTopics.hotPosts.slice(0, 3).map((p, i) => (
                <a key={p.id} href={`/feed/${p.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{p.title || '글'}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>♥{p.like_count} 💬{p.comment_count}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ NEW: 활동 랭킹 ═══ */}
      {d.activityRanking.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '16px', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>🏆 오늘의 활발한 카더라인</div>
          {d.activityRanking.slice(0, 3).map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.nickname}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>글 {u.posts}개 · {u.points.toLocaleString()}P</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ S1: 주식 시장 ═══ */}
      <SH icon="📈" title="국내 시장 · 시총 TOP 10" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
        <table style={{ width: '100%', fontSize: 'var(--fs-xs)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>종목</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>현재가</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>전주比</th>
              <th style={{ textAlign: 'right', padding: '5px 4px', color: 'var(--text-tertiary)', fontWeight: 600 }}>시총</th>
            </tr>
          </thead>
          <tbody>
            {d.stockTop10.map((s, i) => (
              <tr key={s.symbol} style={{ borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '6px 4px', color: 'var(--text-tertiary)' }}>{i + 1}</td>
                <td style={{ padding: '6px 4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 3 }}>{s.sector}</span>
                </td>
                <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text-primary)' }}>{Number(s.price).toLocaleString()}</td>
                <td style={{ textAlign: 'right', padding: '6px 4px' }}>
                  {s.week_ago ? (
                    <span style={{ color: pctColor(s.week_pct), fontWeight: 600 }}>
                      {pctStr(s.week_pct)}
                    </span>
                  ) : <span style={{ color: 'var(--text-tertiary)' }}>-</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '6px 4px', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {s.market_cap > 1e15 ? Math.round(s.market_cap / 1e12) + '조' : Math.round(s.market_cap / 1e12) + '조'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
          전주比 상승 {weekUp} · 하락 {weekDn} · 보합 {10 - weekUp - weekDn}
        </div>
      </div>

      {/* 섹터 히트맵 */}
      <SH icon="🗂️" title={`섹터 히트맵 (${d.sectors.length}개)`} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {d.sectors.slice(0, 14).map(s => {
          const isUp = s.avg_pct > 0;
          return (
            <div key={s.sector} style={{
              padding: '4px 6px', borderRadius: 'var(--radius-xs)', textAlign: 'center', minWidth: 48,
              background: isUp ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.06)',
              border: `1px solid ${isUp ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{s.sector}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: pctColor(s.avg_pct) }}>{pctStr(s.avg_pct)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.cap_t}조</div>
            </div>
          );
        })}
      </div>

      {/* 지수 & 환율 */}
      {(d.indices?.length > 0 || d.exchangeRate > 0) && (
        <>
          <SH icon="📊" title="지수 & 환율" />
          <div className="kd-grid-6" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((d.indices?.length || 0) + (d.exchangeRate > 0 ? 1 : 0), 5)}, 1fr)`, gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
            {(d.indices || []).map(idx => {
              const isKr = idx.label === 'KOSPI' || idx.label === 'KOSDAQ';
              const color = idx.change_pct > 0 ? (isKr ? 'var(--accent-red)' : 'var(--accent-green)') : idx.change_pct < 0 ? (isKr ? 'var(--accent-blue)' : 'var(--accent-red)') : 'var(--text-tertiary)';
              return (
                <div key={idx.label} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}`, borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx.label}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{idx.label.includes('S&P') || idx.label === 'NASDAQ' ? Number(idx.value).toLocaleString('en', { maximumFractionDigits: 0 }) : fmt(idx.value)}</div>
                  {idx.change_pct !== 0 && <div style={{ fontSize: 10, color, fontWeight: 700 }}>{idx.change_pct > 0 ? '▲' : '▼'}{Math.abs(idx.change_pct).toFixed(2)}%</div>}
                </div>
              );
            })}
            {d.exchangeRate > 0 && (
              <div style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)' }}>USD/KRW</div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>₩{d.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 글로벌 */}
      <SH icon="🌎" title="글로벌 마켓" />
      <div className="kd-grid-6" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(d.globalStocks.length, 6)}, 1fr)`, gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
        {d.globalStocks.slice(0, 6).map(s => {
          const pct = s.change_pct ?? 0;
          const color = pct > 0 ? 'var(--accent-green)' : pct < 0 ? 'var(--accent-red)' : 'var(--text-tertiary)';
          return (
            <div key={s.symbol} style={{ background: G.goldBg, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center', border: `1px solid ${G.goldBorder}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.gold }}>{s.symbol}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>${Number(s.price).toFixed(0)}</div>
              {pct !== 0 && <div style={{ fontSize: 10, color, fontWeight: 700 }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>${fmtB(s.market_cap)}</div>
            </div>
          );
        })}
      </div>

      {/* ═══ S2: 청약 캘린더 ═══ */}
      <SH icon="🏗️" title="이번주 청약 캘린더" />
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
        {d.subscriptions.filter(s => s.status !== '마감').length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 16 }}>이번주 청약 일정이 없습니다.</div>
        ) : (
          d.subscriptions.filter(s => s.status !== '마감').map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-sm)', padding: '8px 0', borderBottom: i < d.subscriptions.filter(s => s.status !== '마감').length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 42, textAlign: 'center', flexShrink: 0, borderRight: '1px solid var(--border)', paddingRight: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{new Date(s.rcept_bgnde).getDate()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(new Date(s.rcept_bgnde).getMonth() + 1)}월</div>
                {s.rcept_bgnde === d.date && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-red)' }}>TODAY</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>{s.house_nm}</span>
                  <span style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                    background: s.status === '접수중' ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
                    color: s.status === '접수중' ? 'var(--accent-green)' : 'var(--text-brand)',
                  }}>{s.status}</span>
                  {s.region_nm === d.region && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-yellow)' }}>내 지역</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {s.region_nm} · {s.tot_supply_hshld_co.toLocaleString()}세대 · {s.constructor_nm?.split('(')[0]}
                  {s.price_per_pyeong_avg ? ` · 평당 ${s.price_per_pyeong_avg >= 10000 ? (s.price_per_pyeong_avg / 10000).toFixed(0) + '억' : s.price_per_pyeong_avg.toLocaleString() + '만'}` : ''}
                  {' '}~{s.rcept_endde.slice(5)}
                </div>
              </div>
            </div>
          ))
        )}
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)', textAlign: 'right' }}>
          이번주 총 {d.subCountThisWeek}건 · {d.subUnitsThisWeek.toLocaleString()}세대
        </div>
      </div>

      {/* ═══ S3: 구별 시세 ═══ */}
      {d.guPrices.length > 0 && (
        <>
          <SH icon="🏢" title={`${d.region} 아파트 시세 (${d.guPrices.length}개 구/시)`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
            {d.guPrices.slice(0, 12).map((g, i) => {
              const salePct = Math.round(g.sale / maxGu * 100);
              const jonsePct = Math.round(g.jeonse / maxGu * 100);
              return (
                <div key={g.sigungu} style={{ marginBottom: i < Math.min(d.guPrices.length, 12) - 1 ? 6 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', marginBottom: 3 }}>
                    <span style={{ fontWeight: i < 3 ? 700 : 500, color: i < 3 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g.sigungu}</span>
                    <span>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{fmt(g.sale)}</span>
                      <span style={{ color: 'var(--text-tertiary)', margin: '0 3px' }}>·</span>
                      <span style={{ color: 'var(--text-brand)' }}>{fmt(g.jeonse)}</span>
                      <span style={{ color: g.jeonse_ratio >= 68 ? 'var(--accent-green)' : 'var(--text-tertiary)', marginLeft: 4, fontSize: 12 }}>{g.jeonse_ratio}%</span>
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', height: '100%', width: `${salePct}%`, borderRadius: 4, background: 'rgba(239,68,68,0.25)' }} />
                    <div style={{ position: 'absolute', height: '100%', width: `${jonsePct}%`, borderRadius: 4, background: 'rgba(59,130,246,0.35)' }} />
                  </div>
                </div>
              );
            })}
            {d.guPrices.length > 12 && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {d.guPrices.slice(12).map(g => `${g.sigungu} ${fmt(g.sale)}`).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 4, borderRadius: 4, background: 'rgba(239,68,68,0.3)', marginRight: 2 }} />매매</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 4, borderRadius: 4, background: 'rgba(59,130,246,0.4)', marginRight: 2 }} />전세</span>
              <span>전세율 <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>68%+</span> = 갭투자 유리</span>
            </div>
          </div>
        </>
      )}

      {/* ═══ S4: 미분양 + 재개발 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6 }}>
        <div>
          <SH icon="🏚️" title="미분양" />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div><span style={{ fontSize: 16, fontWeight: 800 }}>{d.unsoldUnits.toLocaleString()}</span><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>세대</span></div>
              <span style={{ fontSize: 10, fontWeight: 600, color: localUnsoldPct < 5 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {d.region} {localUnsoldPct}%
              </span>
            </div>
            {d.unsoldByRegion.slice(0, 4).map((r, i) => {
              const mx = d.unsoldByRegion[0]?.units || 1;
              return (
                <div key={r.region_nm} style={{ marginBottom: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: r.region_nm === d.region ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: r.region_nm === d.region ? 700 : 400 }}>{r.region_nm}</span>
                    <span style={{ fontWeight: 600, color: i === 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{r.units.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(r.units / mx * 100)}%`, borderRadius: 4, background: r.region_nm === d.region ? 'var(--brand)' : i === 0 ? 'var(--accent-red)' : 'var(--text-tertiary)' }} />
                  </div>
                </div>
              );
            })}
            {d.unsoldLocal.length > 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{d.region} TOP</span>: {d.unsoldLocal.slice(0, 3).map(r => `${r.sigungu} ${r.units}`).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <div>
          <SH icon="🔨" title={`${d.region} 재개발`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 'var(--sp-xs)' }}>
              {d.redevTotal}건 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>재개발 {d.redevTotal - d.redevRebuild} · 재건축 {d.redevRebuild}</span>
            </div>
            {d.redevStages.length > 0 && (
              <div style={{ display: 'flex', gap: 1, marginBottom: 'var(--sp-xs)' }}>
                {d.redevStages.map((st, i) => {
                  const total = d.redevStages.reduce((s, x) => s + x.cnt, 0);
                  const colors = ['var(--text-tertiary)', 'var(--text-brand)', '#7C3AED', 'var(--accent-yellow)', 'var(--accent-green)', 'var(--accent-green)'];
                  return (
                    <div key={st.stage} style={{
                      flex: Math.max(st.cnt / total, 0.08), height: 16, borderRadius: 4,
                      background: colors[i] || 'var(--text-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff',
                    }}>{st.cnt}</div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              {d.redevStages.map(s => `${s.stage} ${s.cnt}`).join(' · ')}
            </div>
            {d.redevMajor.length > 0 && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-xs)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>재건축</span>: {d.redevMajor.slice(0, 5).join(' · ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ NEW: 이달의 실거래 동향 ═══ */}
      {d.tradeTrend && d.tradeTrend.thisMonth.deals > 0 && (
        <>
          <SH icon="🏠" title={`${d.region} 이달의 실거래`} />
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 8 }}>
            {/* KPI 행 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: G.goldLight }}>{d.tradeTrend.thisMonth.deals}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>이달 거래</div>
                {d.tradeTrend.lastMonth.deals > 0 && (
                  <div style={{ fontSize: 10, color: d.tradeTrend.thisMonth.deals > d.tradeTrend.lastMonth.deals ? 'var(--accent-red)' : 'var(--accent-blue)', fontWeight: 600 }}>
                    전월 {d.tradeTrend.lastMonth.deals}건
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: G.goldLight }}>{fmt(d.tradeTrend.thisMonth.avgPrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>평균 매매가</div>
                {d.tradeTrend.lastMonth.avgPrice > 0 && (() => {
                  const diff = Math.round((d.tradeTrend!.thisMonth.avgPrice - d.tradeTrend!.lastMonth.avgPrice) / d.tradeTrend!.lastMonth.avgPrice * 100);
                  return <div style={{ fontSize: 10, color: diff >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)', fontWeight: 600 }}>{diff >= 0 ? '▲' : '▼'}{Math.abs(diff)}%</div>;
                })()}
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-red)' }}>{fmt(d.tradeTrend.thisMonth.maxPrice)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>최고가</div>
                {d.tradeTrend.thisMonth.maxAptName && <div style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tradeTrend.thisMonth.maxAptName}</div>}
              </div>
            </div>
            {/* 최근 고가 거래 */}
            {d.tradeTrend.hotDeals.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: G.gold, marginBottom: 6 }}>🔥 최근 2주 고가 거래</div>
                {d.tradeTrend.hotDeals.map((deal, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < d.tradeTrend!.hotDeals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{deal.apt_name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>{deal.sigungu} · {Math.round(deal.exclusive_area)}㎡</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-red)' }}>{fmt(deal.deal_amount)}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>{deal.deal_date.slice(5)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* ═══ NEW: 추천 분석 블로그 ═══ */}
      {d.recommendBlogs.length > 0 && (
        <>
          <SH icon="📰" title="오늘의 추천 분석" />
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {d.recommendBlogs.map(blog => {
              const catIcon = blog.category === 'stock' ? '📈' : blog.category === 'apt' ? '🏢' : blog.category === 'unsold' ? '🏚️' : '💰';
              const catLabel = blog.category === 'stock' ? '주식' : blog.category === 'apt' ? '부동산' : blog.category === 'unsold' ? '미분양' : '재테크';
              return (
                <Link key={blog.slug} href={`/blog/${blog.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{catIcon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blog.excerpt || '카더라에서 읽기'}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,123,246,0.08)', color: 'var(--brand)', flexShrink: 0 }}>{catLabel}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ S5: 요약 + 내일 체크포인트 — 회원전용 골드 ═══ */}
      <SH icon="📋" title="오늘의 요약 + 내일 체크포인트" />
      <div className="report-summary" style={{
        background: `linear-gradient(145deg, var(--bg-surface) 0%, rgba(212,168,83,0.04) 100%)`,
        borderRadius: 'var(--radius-card)',
        border: `2px solid ${G.gold}`,
        padding: '16px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 상단 골드 라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G.goldDark}, ${G.gold}, ${G.goldLight}, ${G.gold}, ${G.goldDark})` }} />
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 2, marginBottom: 'var(--sp-md)' }}>

          {/* 주식 시장 요약 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 주식 시장</div>
            국내 <Link href="/stock" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>시총 TOP 10</Link> 종목 중 <b style={{ color: 'var(--accent-red)' }}>{weekUp}개 종목이 상승</b>, <b style={{ color: 'var(--accent-blue)' }}>{weekDn}개 종목이 하락</b>했습니다.
            {d.sectors[0] && <> 섹터별로는 <Link href={`/stock/sector/${encodeURIComponent(d.sectors[0].sector)}`} style={{ color: pctColor(d.sectors[0].avg_pct), textDecoration: 'none', fontWeight: 700 }}>{d.sectors[0].sector}</Link> 섹터가 <span style={{ color: pctColor(d.sectors[0].avg_pct), fontWeight: 700 }}>{pctStr(d.sectors[0].avg_pct)}</span>로 가장 강한 흐름을 보였습니다.</>}
            {' '}전체 {d.sectors.length}개 섹터 가운데 <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{sectorUp}개 상승</span>, <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{sectorDn}개 하락</span>하며 {sectorUp > sectorDn ? '시장 전반에 매수 심리가 우세한' : sectorUp === sectorDn ? '관망세가 짙은' : '매도 압력이 강한'} 장세를 보이고 있습니다.
            {d.stockTop10[0] && <> 시총 1위 <Link href={`/stock/${d.stockTop10[0].symbol}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 700 }}>{d.stockTop10[0].name}</Link>은 현재 <b style={{ color: 'var(--text-primary)' }}>{Number(d.stockTop10[0].price).toLocaleString()}원</b>{d.stockTop10[0].week_pct != null && d.stockTop10[0].week_pct !== 0 ? <>, 주간 <span style={{ color: pctColor(d.stockTop10[0].week_pct), fontWeight: 700 }}>{pctStr(d.stockTop10[0].week_pct)}</span>의 변동을 기록</> : ''}하고 있습니다.</>}
            {d.globalStocks.length > 0 && <> 해외 시장에서는 {d.globalStocks.slice(0, 3).map((s, i) => <span key={s.symbol}>{i > 0 && ', '}<Link href={`/stock/${s.symbol}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}>{s.symbol}</Link> ${Number(s.price).toFixed(0)}{s.change_pct ? <span style={{ color: s.change_pct > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: 11 }}>({s.change_pct > 0 ? '+' : ''}{s.change_pct.toFixed(1)}%)</span> : ''}</span>)} 수준에서 거래되고 있습니다.</>}
            {d.exchangeRate > 0 && <> 원/달러 환율은 <b style={{ color: 'var(--text-primary)' }}>₩{d.exchangeRate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</b>입니다.</>}
          </div>

          {/* 청약 시장 요약 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 청약 시장</div>
            이번 주 전국 <Link href="/apt" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>{d.subCountThisWeek}건</Link>의 아파트 청약이 예정되어 있으며, 총 <b style={{ color: 'var(--text-primary)' }}>{d.subUnitsThisWeek.toLocaleString()}세대</b> 규모입니다.
            {d.subscriptions.filter(s => s.status === '접수중').length > 0 && <> 현재 접수가 진행 중인 단지는 <b style={{ color: 'var(--text-primary)' }}>{d.subscriptions.filter(s => s.status === '접수중').length}건</b>으로, {d.subscriptions.filter(s => s.status === '접수중').slice(0, 2).map(s => s.house_nm).join(', ')} 등이 있습니다.</>}
            {d.subscriptions.filter(s => s.rcept_bgnde === d.date).length > 0 && <> 오늘 접수가 시작되는 단지로는 <b style={{ color: 'var(--accent-red)' }}>{d.subscriptions.filter(s => s.rcept_bgnde === d.date).map(s => s.house_nm).join(', ')}</b>이(가) 있으니 관심 있는 분은 일정을 확인해 보시기 바랍니다.</>}
            {d.subscriptions.filter(s => s.status === '접수중').length === 0 && d.subscriptions.filter(s => s.rcept_bgnde === d.date).length === 0 && <> 이번 주 남은 접수 일정을 확인하고 관심 단지를 미리 체크해 두시는 것을 권장합니다.</>}
          </div>

          {/* 미분양 현황 */}
          <div style={{ marginBottom: 'var(--sp-md)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 미분양 현황</div>
            전국 <Link href="/apt?tab=unsold" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>미분양 아파트</Link>는 총 <b style={{ color: localUnsoldPct > 8 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{d.unsoldUnits.toLocaleString()}세대</b>입니다. <Link href={`/apt/region/${encodeURIComponent(d.region)}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{d.region}</Link> 지역의 미분양은 <b style={{ color: 'var(--text-primary)' }}>{localUnsoldUnits.toLocaleString()}세대</b>로 전국 대비 <span style={{ color: localUnsoldPct < 3 ? 'var(--accent-green)' : localUnsoldPct > 8 ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: 700 }}>{localUnsoldPct}%</span>를 차지하고 있습니다.
            {localUnsoldPct < 3 ? ` ${d.region}은 미분양 비중이 매우 낮아 수요가 안정적인 지역으로 평가됩니다.` : localUnsoldPct < 8 ? ` ${d.region}의 미분양 비중은 보통 수준이며, 신규 분양 시 수요 분석이 필요합니다.` : ` ${d.region}의 미분양 비중이 다소 높아 분양 시장 주의가 필요합니다.`}
            {d.unsoldLocal.length > 0 && <> 지역 내 주요 미분양 집중 지역은 {d.unsoldLocal.slice(0, 3).map(u => `${u.sigungu}(${u.units}세대)`).join(', ')} 순입니다.</>}
          </div>

          {/* 재개발 동향 */}
          <div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 재개발·재건축</div>
            <Link href={`/apt/region/${encodeURIComponent(d.region)}`} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>{d.region}</Link> 지역에서는 현재 총 <Link href="/apt?tab=redev" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 700 }}>{d.redevTotal}건</Link>의 정비사업이 진행 중입니다.
            {d.redevStages[0] && <> 단계별로는 {d.redevStages[0].stage}이 {d.redevStages[0].cnt}건({d.redevTotal > 0 ? Math.round((d.redevStages[0].cnt || 0) / d.redevTotal * 100) : 0}%)으로 가장 많으며</>}
            {d.redevStages[1] && <>, {d.redevStages[1].stage} {d.redevStages[1].cnt}건이 뒤를 잇고 있습니다</>}.
            {d.redevRebuild > 0 && <> 이 중 재건축 사업은 {d.redevRebuild}건이며, 나머지는 재개발로 분류됩니다.</>}
            {' '}정비사업 진행 현황은 입주권·분양권 투자 판단의 핵심 지표이므로 단계별 변동을 지속적으로 모니터링하시기 바랍니다.
          </div>
        </div>

        {/* 내일 체크포인트 — 골드 */}
        <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: G.gold, marginBottom: 4 }}>✦ 내일 체크포인트</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {d.subscriptions.filter(s => s.status === '접수중').map(s => `• ${s.house_nm} 마감 D-${Math.max(0, Math.ceil((new Date(s.rcept_endde).getTime() - now.getTime()) / 86400000))}`).slice(0, 3).join('\n').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
            {d.subscriptions.filter(s => {
              const tmr = new Date(now);
              tmr.setDate(tmr.getDate() + 1);
              return s.rcept_bgnde === tmr.toISOString().slice(0, 10);
            }).map(s => `• ${s.house_nm} 내일 접수시작`).map((l, i) => <span key={'t' + i}>{l}<br /></span>)}
            • 주식 섹터 추이 연속 확인 — {d.sectors[0]?.sector} {d.sectors[0]?.avg_pct > 0 ? '상승 지속?' : '반등?'}
          </div>
        </div>

      </div>

      {/* 공유 CTA */}
      <div style={{ marginTop: 'var(--sp-md)', padding: '16px', borderRadius: 'var(--radius-card)', background: 'linear-gradient(135deg, rgba(59,123,246,0.06), rgba(46,232,165,0.04))', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>오늘 리포트가 유익했다면?</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>카카오톡·밴드로 공유하면 +5P 적립!</div>
        <ShareButtons title={`카더라 데일리 리포트 — ${d.region} ${d.date}`} contentType="daily" contentRef={`${d.region}-${d.date}`} />
      </div>

      {/* 푸터 — 리포트 소개 */}
      <div style={{ marginTop: 'var(--sp-md)', padding: '14px 16px', borderRadius: 'var(--radius-card)', background: G.goldBg, border: `1px solid ${G.goldBorder}` }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <span style={{ color: G.gold, fontWeight: 700 }}>발행</span> 매일 오전 7시 (평일) · 주말판 토요일 오전 발행<br/>
          <span style={{ color: G.gold, fontWeight: 700 }}>내용</span> 국내외 <Link href="/stock" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>주식 시황</Link> · <Link href="/apt" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>청약 캘린더</Link> · <Link href="/apt?tab=unsold" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>미분양 현황</Link> · <Link href="/apt?tab=redev" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>재개발 동향</Link> · 시군구별 시세<br/>
          <span style={{ color: G.gold, fontWeight: 700 }}>대상</span> 카더라 회원 (거주지 등록 필수)
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '10px 0', marginTop: 'var(--sp-sm)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        <span style={{ color: G.goldDark, fontWeight: 700, letterSpacing: 1 }}>KADEORA DAILY REPORT</span> #{d.issueNo}<br/>
        <Disclaimer type="stock" compact />
      </div>
    </div>
  );
}
