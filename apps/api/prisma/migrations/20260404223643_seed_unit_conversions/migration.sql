-- ─── Fix duplicate `ribs` unit (created during latest scrape run) ────────────
UPDATE "recipe_ingredients" SET "unitId" = (SELECT "id" FROM "units" WHERE "symbol" = 'rib' LIMIT 1)
  WHERE "unitId" IN (SELECT "id" FROM "units" WHERE "symbol" = 'ribs');
UPDATE "grocery_list_items" SET "unitId" = (SELECT "id" FROM "units" WHERE "symbol" = 'rib' LIMIT 1)
  WHERE "unitId" IN (SELECT "id" FROM "units" WHERE "symbol" = 'ribs');
DELETE FROM "units" WHERE "symbol" = 'ribs';
-- Note: Unit conversion data is seeded via `npm run db:seed-conversions`
-- (see apps/api/src/catalog/seed-conversions.ts) to avoid shadow-DB validation issues.
