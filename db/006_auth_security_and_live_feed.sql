BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE api.site_users
  ADD COLUMN IF NOT EXISTS password_hash text;

ALTER TABLE api.site_users
  ALTER COLUMN password_plain DROP NOT NULL;

UPDATE api.site_users
SET password_hash = crypt(password_plain, gen_salt('bf', 10))
WHERE password_hash IS NULL
  AND password_plain IS NOT NULL;

CREATE OR REPLACE FUNCTION api.register_user(
  p_full_name text,
  p_email text,
  p_password text,
  p_role text DEFAULT 'buyer'
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_user api.site_users;
BEGIN
  IF coalesce(trim(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF coalesce(p_password, '') = '' THEN
    RAISE EXCEPTION 'Password is required';
  END IF;

  IF p_role NOT IN ('buyer', 'seller', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM api.site_users u
    WHERE lower(u.email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  INSERT INTO api.site_users (full_name, email, password_hash, password_plain, role)
  VALUES (
    trim(p_full_name),
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf', 10)),
    NULL,
    p_role
  )
  RETURNING * INTO v_user;

  RETURN QUERY
  SELECT v_user.id, v_user.full_name, v_user.email, v_user.role;
END;
$$;

CREATE OR REPLACE FUNCTION api.login_user(
  p_email text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_user api.site_users;
BEGIN
  SELECT *
  INTO v_user
  FROM api.site_users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_user.password_hash IS NULL THEN
    IF v_user.password_plain IS NULL OR v_user.password_plain <> p_password THEN
      RETURN;
    END IF;

    UPDATE api.site_users
    SET password_hash = crypt(p_password, gen_salt('bf', 10)),
        password_plain = NULL
    WHERE id = v_user.id
    RETURNING * INTO v_user;
  ELSIF crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_user.id, v_user.full_name, v_user.email, v_user.role;
END;
$$;

DROP POLICY IF EXISTS site_users_select_anon ON api.site_users;
DROP POLICY IF EXISTS site_users_insert_anon ON api.site_users;

REVOKE ALL ON api.site_users FROM web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.site_users TO app_user;
GRANT EXECUTE ON FUNCTION api.register_user(text, text, text, text) TO web_anon;
GRANT EXECUTE ON FUNCTION api.login_user(text, text) TO web_anon;

CREATE OR REPLACE VIEW api.v_lot_feed AS
SELECT
  l.id,
  l.auction_id,
  a.title AS auction_title,
  l.lot_number,
  l.title,
  l.description,
  l.image_url,
  l.current_bid,
  l.starting_bid,
  l.bid_count,
  l.is_featured,
  l.is_hot,
  l.ends_at,
  a.city,
  a.state,
  a.shipping_available,
  a.pickup_available,
  s.display_name AS seller_name,
  s.verified AS seller_verified,
  c.slug AS category_slug,
  c.name AS category_name
FROM api.lots l
JOIN api.auctions a ON a.id = l.auction_id
JOIN api.sellers s ON s.id = a.seller_id
LEFT JOIN api.auction_categories c ON c.id = a.category_id
WHERE a.status IN ('live', 'scheduled')
  AND l.ends_at > now();

NOTIFY pgrst, 'reload schema';

COMMIT;
