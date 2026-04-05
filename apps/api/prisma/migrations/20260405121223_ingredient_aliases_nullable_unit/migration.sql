-- DropForeignKey
ALTER TABLE "grocery_list_items" DROP CONSTRAINT "grocery_list_items_unitId_fkey";

-- DropForeignKey
ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_unitId_fkey";

-- AlterTable
ALTER TABLE "grocery_list_items" ALTER COLUMN "unitId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "recipe_ingredients" ALTER COLUMN "unitId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ingredient_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,

    CONSTRAINT "ingredient_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_aliases_alias_key" ON "ingredient_aliases"("alias");

-- AddForeignKey
ALTER TABLE "ingredient_aliases" ADD CONSTRAINT "ingredient_aliases_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
