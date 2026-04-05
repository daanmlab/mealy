-- ─── Fix plural/singular unit fragmentation ─────────────────────────────────
-- For each pair, redirect all references to the canonical unit, then delete the duplicate.
-- Canonical choices are based on usage frequency (more-used form wins).

-- clove (4 uses) → cloves (5 uses, canonical)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkugex7001znxnxd5148kr5' WHERE "unitId" = 'cmnkufu00000lnxnxn89szn2f';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkugex7001znxnxd5148kr5' WHERE "unitId" = 'cmnkufu00000lnxnxn89szn2f';
DELETE FROM "units" WHERE "id" = 'cmnkufu00000lnxnxn89szn2f'; -- clove

-- cups (10 uses) → cup (23 uses, canonical)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkufu04000onxnxcfn23tyv' WHERE "unitId" = 'cmnkuhlo7004anxnxtzstd3s2';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkufu04000onxnxcfn23tyv' WHERE "unitId" = 'cmnkuhlo7004anxnxtzstd3s2';
DELETE FROM "units" WHERE "id" = 'cmnkuhlo7004anxnxtzstd3s2'; -- cups

-- fillet (1 use) → fillets (2 uses, canonical)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkupx7s00l3nxnxxkn8hmso' WHERE "unitId" = 'cmnkul15z00bknxnx5l286wmh';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkupx7s00l3nxnxxkn8hmso' WHERE "unitId" = 'cmnkul15z00bknxnx5l286wmh';
DELETE FROM "units" WHERE "id" = 'cmnkul15z00bknxnx5l286wmh'; -- fillet

-- leaves (1 use) → leaf (1 use, canonical — singular preferred for display)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkui47i005cnxnxiuvt0xka' WHERE "unitId" = 'cmnkum02z00dgnxnx6v45dw0s';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkui47i005cnxnxiuvt0xka' WHERE "unitId" = 'cmnkum02z00dgnxnx6v45dw0s';
DELETE FROM "units" WHERE "id" = 'cmnkum02z00dgnxnx6v45dw0s'; -- leaves

-- pieces (2 uses) → piece (3 uses, canonical)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkui4780059nxnxxmrowlqs' WHERE "unitId" = 'cmnkuk4eu00a9nxnxxvgc6pbf';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkui4780059nxnxxmrowlqs' WHERE "unitId" = 'cmnkuk4eu00a9nxnxxvgc6pbf';
DELETE FROM "units" WHERE "id" = 'cmnkuk4eu00a9nxnxxvgc6pbf'; -- pieces

-- ribs (1 use) → rib (1 use, canonical — singular preferred for display)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkuikq5006unxnx4ly1994k' WHERE "unitId" = 'cmnkujcl2008qnxnx2toov6lz';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkuikq5006unxnx4ly1994k' WHERE "unitId" = 'cmnkujcl2008qnxnx2toov6lz';
DELETE FROM "units" WHERE "id" = 'cmnkujcl2008qnxnx2toov6lz'; -- ribs

-- sprig (1 use) → sprigs (4 uses, canonical)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkufu0a000rnxnx8yja6kq0' WHERE "unitId" = 'cmnkusn2c0001ggnxxud9ei8o';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkufu0a000rnxnx8yja6kq0' WHERE "unitId" = 'cmnkusn2c0001ggnxxud9ei8o';
DELETE FROM "units" WHERE "id" = 'cmnkusn2c0001ggnxxud9ei8o'; -- sprig

-- sticks (1 use) → stick (1 use, canonical — singular preferred for display)
UPDATE "recipe_ingredients" SET "unitId" = 'cmnkui47c005anxnxrglpn7qy' WHERE "unitId" = 'cmnkusn210000ggnx35iihi9c';
UPDATE "grocery_list_items" SET "unitId" = 'cmnkui47c005anxnxrglpn7qy' WHERE "unitId" = 'cmnkusn210000ggnx35iihi9c';
DELETE FROM "units" WHERE "id" = 'cmnkusn210000ggnx35iihi9c'; -- sticks

-- ─── Fix garlic ingredient fragmentation ─────────────────────────────────────
-- Canonical: "garlic" (cmnkufu1k0011nxnxstdh1745)
-- Merge "garlic clove" (12 recipes) and "garlic cloves" (6 recipes) into "garlic".

UPDATE "recipe_ingredients" SET "ingredientId" = 'cmnkufu1k0011nxnxstdh1745' WHERE "ingredientId" = 'cmnkuhlop004hnxnx7pq2aemb'; -- garlic clove → garlic
UPDATE "recipe_ingredients" SET "ingredientId" = 'cmnkufu1k0011nxnxstdh1745' WHERE "ingredientId" = 'cmnkuixh10087nxnx29xxrnsu'; -- garlic cloves → garlic
UPDATE "grocery_list_items" SET "ingredientId" = 'cmnkufu1k0011nxnxstdh1745' WHERE "ingredientId" = 'cmnkuhlop004hnxnx7pq2aemb';
UPDATE "grocery_list_items" SET "ingredientId" = 'cmnkufu1k0011nxnxstdh1745' WHERE "ingredientId" = 'cmnkuixh10087nxnx29xxrnsu';

-- After merging, some recipes may now have two "garlic" rows (garlic + garlic clove both in same recipe).
-- Merge duplicate garlic rows within each recipe: sum amounts, keep one row.
-- This uses a CTE to identify and consolidate duplicates.
WITH duplicates AS (
  SELECT
    "recipeId",
    "ingredientId",
    "unitId",
    MIN("id") AS keep_id,
    SUM("amount") AS total_amount
  FROM "recipe_ingredients"
  WHERE "ingredientId" = 'cmnkufu1k0011nxnxstdh1745'
  GROUP BY "recipeId", "ingredientId", "unitId"
  HAVING COUNT(*) > 1
)
UPDATE "recipe_ingredients" ri
SET "amount" = d.total_amount
FROM duplicates d
WHERE ri."id" = d.keep_id;

DELETE FROM "recipe_ingredients"
WHERE "ingredientId" = 'cmnkufu1k0011nxnxstdh1745'
  AND "id" NOT IN (
    SELECT MIN("id")
    FROM "recipe_ingredients"
    WHERE "ingredientId" = 'cmnkufu1k0011nxnxstdh1745'
    GROUP BY "recipeId", "ingredientId", "unitId"
  );

-- Now safe to delete the merged ingredient records
DELETE FROM "ingredients" WHERE "id" = 'cmnkuhlop004hnxnx7pq2aemb'; -- garlic clove
DELETE FROM "ingredients" WHERE "id" = 'cmnkuixh10087nxnx29xxrnsu'; -- garlic cloves
