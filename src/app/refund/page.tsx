import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL + '/refund' },
  robots: { index: false, follow: true },
  title: '환불정책',
  description: '카더라 환불 및 청약철회 정책',
};

export default function RefundPage() {
  const sections: [string, string][] = [
    ['제1조 (목적)', '본 환불정책은 카더라(이하 "서비스")에서 제공하는 유료 디지털 부가서비스 구매 시 환불 및 청약철회에 관한 사항을 규정합니다.'],
    ['제2조 (판매 상품)', '서비스에서 판매하는 유료 상품은 다음과 같은 디지털 부가서비스입니다.\n\n[프로 멤버십]\n• 프로 멤버십 월간: 24,900원 (관심 종목·단지 무제한, AI 분석, 급등락 알림, 데일리 리포트, CSV 다운로드 등)\n• 프로 멤버십 연간: 249,000원 (월간 대비 17% 할인)\n\n[확성기]\n• 확성기 라이트 (공지배너 노출 2회): 4,900원\n• 확성기 스탠다드 (공지배너 노출 5회): 9,900원\n• 확성기 프리미엄 (공지배너 노출 10회): 19,900원\n• 확성기 무제한 (3일간 무제한 노출): 29,900원\n\n[기타]\n• 닉네임 변경권 (1회): 9,900원\n\n위 상품은 결제 즉시 적용되는 무형의 디지털 콘텐츠로, 별도의 배송이 없습니다.'],
    ['제3조 (환불 가능 조건)', '다음의 경우 전액 환불이 가능합니다.\n\n• 결제 후 서비스가 정상 제공되지 않은 경우\n• 결제 오류로 인한 중복 결제가 발생한 경우\n• 시스템 장애로 구매한 서비스를 이용할 수 없는 경우\n\n환불 요청은 결제일로부터 7일 이내에 아래 연락처로 접수해 주세요.'],
    ['제4조 (환불 제한)', '전자상거래 등에서의 소비자보호에 관한 법률 제17조 제2항에 따라, 다음의 경우 청약철회가 제한됩니다.\n\n• 구매 후 서비스 이용이 시작된 경우 (확성기 노출 시작, 뱃지 적용 완료)\n• 디지털 콘텐츠의 특성상 이용 개시 후에는 환불이 불가합니다.\n\n단, 서비스 장애 등 서비스 제공자의 귀책사유가 있는 경우에는 이용 개시 후에도 잔여 기간에 대해 환불이 가능합니다.\n\n[프로 멤버십 환불 특칙]\n• 구독 시작 후 7일 이내 프로 전용 기능 미사용 시: 전액 환불\n• 구독 시작 후 7일 경과 또는 프로 기능 사용 시: 잔여 기간 일할 계산 환불 (서비스 장애 귀책사유 시)\n• 연간 구독 중도 해지 시: 이용 월수 × 월간 요금(24,900원) 차감 후 잔액 환불'],
    ['제5조 (환불 절차)', '1. 환불 요청: 이메일(kadeora.app@gmail.com) 또는 전화(010-5001-1382)로 접수\n2. 확인 및 심사: 접수 후 영업일 기준 3일 이내 확인\n3. 환불 처리: 승인 후 영업일 기준 5~7일 이내 원래 결제수단으로 환불\n\n환불 요청 시 주문번호, 결제일, 환불 사유를 함께 알려주세요.'],
    ['제6조 (결제 수단)', '서비스의 결제는 토스페이먼츠를 통해 처리되며, 신용카드, 계좌이체, 가상계좌, 간편결제를 지원합니다. 환불 시 원래 결제수단으로 환불됩니다.'],
    ['제7조 (분쟁 해결)', '환불과 관련한 분쟁은 전자상거래 등에서의 소비자보호에 관한 법률 및 관련 법령에 따라 처리합니다. 분쟁 해결이 어려운 경우 한국소비자원에 조정을 신청할 수 있습니다.'],
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px' }}>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>환불정책</h1>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 32 }}>최종 수정일: 2026년 3월 24일</p>
      {sections.map(([title, content]) => (
        <div key={title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>{title}</h2>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{content}</p>
        </div>
      ))}

      <div style={{ marginTop: 40, padding: '20px 24px', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>환불 문의</p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
          이메일: kadeora.app@gmail.com{'\n'}
          전화: 010-5001-1382{'\n'}
          운영시간: 평일 10:00 ~ 18:00 (공휴일 제외)
        </p>
      </div>

      <div style={{ marginTop: 'var(--sp-lg)', padding: '16px 24px', borderRadius: 'var(--radius-card)', backgroundColor: 'var(--bg-sunken)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.7, margin: 0 }}>
          본 환불정책은 전자상거래 등에서의 소비자보호에 관한 법률에 근거합니다.{'\n'}
          정책 변경 시 서비스 내 공지를 통해 안내합니다.
        </p>
      </div>
    </div>
  );
}
