BEGIN;

CREATE TABLE IF NOT EXISTS api.site_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_plain text NOT NULL,
  role text NOT NULL DEFAULT 'buyer',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role IN ('buyer', 'seller', 'admin'))
);

CREATE TABLE IF NOT EXISTS api.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES api.site_users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text,
  city text,
  state text,
  about text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS api.seller_item_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES api.seller_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES api.auction_categories(id),
  title text NOT NULL,
  description text NOT NULL,
  reserve_price numeric(12,2) NOT NULL DEFAULT 0,
  starting_bid numeric(12,2) NOT NULL DEFAULT 1,
  quantity integer NOT NULL DEFAULT 1,
  image_url text,
  city text,
  state text,
  shipping_available boolean NOT NULL DEFAULT false,
  pickup_available boolean NOT NULL DEFAULT true,
  submission_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserve_price >= 0),
  CHECK (starting_bid >= 0),
  CHECK (quantity > 0),
  CHECK (submission_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_site_users_email ON api.site_users(email);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user ON api.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON api.seller_item_submissions(submission_status, created_at DESC);

ALTER TABLE api.site_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.seller_item_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_users_select_anon ON api.site_users;
CREATE POLICY site_users_select_anon ON api.site_users FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS site_users_insert_anon ON api.site_users;
CREATE POLICY site_users_insert_anon ON api.site_users FOR INSERT TO web_anon WITH CHECK (true);

DROP POLICY IF EXISTS site_users_all_app ON api.site_users;
CREATE POLICY site_users_all_app ON api.site_users FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS seller_profiles_select_anon ON api.seller_profiles;
CREATE POLICY seller_profiles_select_anon ON api.seller_profiles FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS seller_profiles_insert_anon ON api.seller_profiles;
CREATE POLICY seller_profiles_insert_anon ON api.seller_profiles FOR INSERT TO web_anon WITH CHECK (true);

DROP POLICY IF EXISTS seller_profiles_update_anon ON api.seller_profiles;
CREATE POLICY seller_profiles_update_anon ON api.seller_profiles FOR UPDATE TO web_anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS seller_profiles_all_app ON api.seller_profiles;
CREATE POLICY seller_profiles_all_app ON api.seller_profiles FOR ALL TO app_user USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS seller_items_select_anon ON api.seller_item_submissions;
CREATE POLICY seller_items_select_anon ON api.seller_item_submissions FOR SELECT TO web_anon USING (true);

DROP POLICY IF EXISTS seller_items_insert_anon ON api.seller_item_submissions;
CREATE POLICY seller_items_insert_anon ON api.seller_item_submissions FOR INSERT TO web_anon WITH CHECK (true);

DROP POLICY IF EXISTS seller_items_all_app ON api.seller_item_submissions;
CREATE POLICY seller_items_all_app ON api.seller_item_submissions FOR ALL TO app_user USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON api.site_users TO web_anon;
GRANT SELECT, INSERT, UPDATE ON api.seller_profiles TO web_anon;
GRANT SELECT, INSERT ON api.seller_item_submissions TO web_anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON api.site_users TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.seller_profiles TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.seller_item_submissions TO app_user;

INSERT INTO api.auction_categories (slug, name, icon, sort_order)
VALUES
  ('art', 'Art', 'palette', 7),
  ('fashion', 'Fashion', 'shirt', 8),
  ('electronics', 'Electronics', 'cpu', 9),
  ('sports', 'Sports Memorabilia', 'trophy', 10),
  ('books', 'Books & Manuscripts', 'book', 11),
  ('music', 'Music & Instruments', 'music', 12),
  ('toys', 'Toys & Games', 'gamepad', 13),
  ('watches', 'Watches', 'watch', 14),
  ('luxury', 'Luxury Goods', 'gem', 15),
  ('antiques', 'Antiques', 'landmark', 16),
  ('industrial', 'Industrial Equipment', 'factory', 17),
  ('furniture', 'Furniture', 'sofa', 18),
  ('kitchen', 'Kitchen & Dining', 'utensils', 19),
  ('pets', 'Pets & Supplies', 'paw', 20),
  ('garden', 'Garden & Outdoor', 'leaf', 21),
  ('health', 'Health & Beauty', 'sparkles', 22),
  ('photography', 'Photography', 'camera', 23),
  ('computers', 'Computers', 'monitor', 24),
  ('phones', 'Phones & Tablets', 'smartphone', 25),
  ('realestate', 'Real Estate', 'building', 26)
ON CONFLICT (slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
