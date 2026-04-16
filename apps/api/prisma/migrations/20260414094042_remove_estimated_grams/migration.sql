-- AlterTable
ALTER TABLE "IngredientNutrients"
ADD COLUMN IF NOT EXISTS "ingredientName" TEXT,
ADD COLUMN IF NOT EXISTS "fdcId" INTEGER;

-- Backfill any pre-existing rows before enforcing NOT NULL
UPDATE "IngredientNutrients"
SET
	"ingredientName" = COALESCE("ingredientName", 'unknown'),
	"fdcId" = COALESCE("fdcId", 0)
WHERE "ingredientName" IS NULL OR "fdcId" IS NULL;

-- Enforce required columns expected by Prisma schema
ALTER TABLE "IngredientNutrients"
ALTER COLUMN "ingredientName" SET NOT NULL,
ALTER COLUMN "fdcId" SET NOT NULL;

-- Remove deprecated column
ALTER TABLE "recipe_ingredients"
DROP COLUMN IF EXISTS "estimatedGrams";
