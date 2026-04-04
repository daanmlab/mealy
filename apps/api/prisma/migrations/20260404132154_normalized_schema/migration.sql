/*
  Warnings:

  - You are about to drop the column `unit` on the `grocery_list_items` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `recipe_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `recipes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sourceUrl]` on the table `recipes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unitId` to the `grocery_list_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `recipe_ingredients` table without a default value. This is not possible if the table is not empty.

*/

-- Clear recipe-scoped rows so we can add required FK columns.
-- Recipe data will be re-imported via the scraper after migration.
TRUNCATE "recipe_ingredients" CASCADE;
TRUNCATE "grocery_list_items" CASCADE;

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('weight', 'volume', 'count', 'other');

-- DropIndex
DROP INDEX "recipe_ingredients_recipeId_ingredientId_key";

-- AlterTable
ALTER TABLE "grocery_list_items" DROP COLUMN "unit",
ADD COLUMN     "unitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "recipe_ingredients" DROP COLUMN "unit",
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "unitId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "recipes" DROP COLUMN "tags",
ADD COLUMN     "sourceUrl" TEXT;

-- DropEnum
DROP TYPE "IngredientCategory";

-- DropEnum
DROP TYPE "RecipeTag";

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_groups" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ingredient_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "recipeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("recipeId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_symbol_key" ON "units"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_fromUnitId_toUnitId_key" ON "unit_conversions"("fromUnitId", "toUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_slug_key" ON "ingredient_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipeId_idx" ON "recipe_ingredients"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_sourceUrl_key" ON "recipes"("sourceUrl");

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_groups" ADD CONSTRAINT "ingredient_groups_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ingredient_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ingredient_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
