-- ============================================
-- 분양 상담사 프리미엄 리스팅 시스템
-- 2026-03-22
-- ============================================

-- 1. 상담사 프로필
CREATE TABLE IF NOT EXISTS consultant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  kakao_id text,
  company text,
  license_no text, -- 공인중개사 자격번호
  bio text,
  profile_image text,
  regions text[] DEFAULT '{}', -- 담당 지역
  is_verified boolean DEFAULT false, -- 관리자 인증
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 프리미엄 리스팅
CREATE TABLE IF NOT EXISTS premium_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES consultant_profiles(id) ON DELETE CASCADE,
  -- 연결 대상 (apt_subscriptions 또는 unsold_apts)
  listing_type text NOT NULL CHECK (listing_type IN ('subscription', 'unsold')),
  listing_id text NOT NULL, -- apt_subscriptions.id 또는 unsold_apts.id
  house_nm text, -- 현장명 캐시
  region_nm text, -- 지역 캐시
  -- 티어
  tier text NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro', 'premium')),
  -- 추가 정보 (PRO 이상)
  images text[] DEFAULT '{}', -- 최대 5장
  description text, -- 현장 소개 (상담사 작성)
  cta_text text DEFAULT '분양 상담 받기', -- CTA 버튼 문구
  cta_phone text, -- CTA 전화번호 (상담사 전화와 다를 수 있음)
  cta_kakao text, -- CTA 카카오톡 링크
  -- 기간
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  -- 결제
  payment_id uuid REFERENCES payments(id),
  price_paid integer DEFAULT 0, -- 결제 금액 (원)
  -- 추적
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  cta_clicks integer DEFAULT 0,
  phone_clicks integer DEFAULT 0,
  -- 타임스탬프
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. 상담사 리스팅 shop_products 등록
INSERT INTO shop_products (id, name, description, icon, price_krw, point_price, purchase_type, is_active, category) VALUES
  ('listing_basic', '프리미엄 리스팅 BASIC', '분양중 카드 골드 하이라이트 + 상단 고정 + 상담사 연락처', '🏢', 49000, 0, 'cash', true, 'listing'),
  ('listing_pro', '프리미엄 리스팅 PRO', 'BASIC + 이미지 3장 + 상담 예약 CTA + 노출/클릭 리포트', '⭐', 149000, 0, 'cash', true, 'listing'),
  ('listing_premium', '프리미엄 리스팅 PREMIUM', 'PRO + 배너 노출 + 관심 유저 푸시 + AI 분석', '👑', 299000, 0, 'cash', true, 'listing')
ON CONFLICT (id) DO NOTHING;

-- 4. RLS
ALTER TABLE consultant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "누구나 조회" ON consultant_profiles FOR SELECT USING (true);
CREATE POLICY "본인만 수정" ON consultant_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE premium_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "누구나 활성 리스팅 조회" ON premium_listings FOR SELECT USING (is_active = true AND expires_at > now());
CREATE POLICY "상담사 본인 전체 조회" ON premium_listings FOR SELECT USING (
  consultant_id IN (SELECT id FROM consultant_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "상담사 본인 생성" ON premium_listings FOR INSERT WITH CHECK (
  consultant_id IN (SELECT id FROM consultant_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "상담사 본인 수정" ON premium_listings FOR UPDATE USING (
  consultant_id IN (SELECT id FROM consultant_profiles WHERE user_id = auth.uid())
);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_premium_listings_active ON premium_listings (is_active, expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_premium_listings_listing ON premium_listings (listing_type, listing_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_consultant_profiles_user ON consultant_profiles (user_id);

-- 6. 노출/클릭 카운터 RPC
CREATE OR REPLACE FUNCTION increment_listing_impression(p_listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE premium_listings SET impressions = impressions + 1 WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_listing_click(p_listing_id uuid, p_click_type text DEFAULT 'click')
RETURNS void AS $$
BEGIN
  IF p_click_type = 'cta' THEN
    UPDATE premium_listings SET cta_clicks = cta_clicks + 1, clicks = clicks + 1 WHERE id = p_listing_id;
  ELSIF p_click_type = 'phone' THEN
    UPDATE premium_listings SET phone_clicks = phone_clicks + 1, clicks = clicks + 1 WHERE id = p_listing_id;
  ELSE
    UPDATE premium_listings SET clicks = clicks + 1 WHERE id = p_listing_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 만료 리스팅 자동 비활성화
CREATE OR REPLACE FUNCTION deactivate_expired_listings()
RETURNS integer AS $$
DECLARE affected integer;
BEGIN
  UPDATE premium_listings SET is_active = false WHERE is_active = true AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
