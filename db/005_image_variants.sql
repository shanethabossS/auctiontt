BEGIN;

ALTER TABLE api.seller_item_submissions
  ADD COLUMN IF NOT EXISTS image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE api.lots
  ADD COLUMN IF NOT EXISTS image_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';

COMMIT;
