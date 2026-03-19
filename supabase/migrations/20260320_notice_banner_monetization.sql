-- #18 NoticeBanner monetization
ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES profiles(id);
ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS linked_post_id uuid REFERENCES posts(id);
ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;
ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS display_start timestamptz;
ALTER TABLE site_notices ADD COLUMN IF NOT EXISTS display_end timestamptz;

INSERT INTO shop_products (name, description, price_krw, point_cost, product_type) VALUES
('전광판 1일 노출권', '내 글을 전광판에 1일 동안 노출합니다', 990, 500, 'banner_1d'),
('전광판 3일 노출권', '내 글을 전광판에 3일 동안 노출합니다', 2200, 1200, 'banner_3d')
ON CONFLICT DO NOTHING;
