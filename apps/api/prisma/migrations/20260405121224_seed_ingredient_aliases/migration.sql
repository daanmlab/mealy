-- Seed one alias row per existing ingredient (normalized: lowercase + trim).
-- This bootstraps the alias table so re-scraped recipes resolve via alias lookup
-- without needing an LLM call.

INSERT INTO ingredient_aliases (id, alias, "ingredientId")
SELECT
  gen_random_uuid()::text,
  lower(trim(name)),
  id
FROM ingredients
ON CONFLICT (alias) DO NOTHING;
