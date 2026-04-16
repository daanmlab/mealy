-- CreateTable
CREATE TABLE "IngredientNutrients" (
    "id" TEXT NOT NULL,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "total_fats" DOUBLE PRECISION,
    "sat_fats" DOUBLE PRECISION,
    "trans_fats" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "cholesterol" DOUBLE PRECISION,
    "Fiber" DOUBLE PRECISION,
    "Sugar" DOUBLE PRECISION,
    "microNutrients" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientNutrients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_nutrient_links" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "nutrientId" TEXT NOT NULL,
    "fdcId" INTEGER,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_nutrient_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingredient_nutrient_links_ingredientId_idx" ON "ingredient_nutrient_links"("ingredientId");

-- CreateIndex
CREATE INDEX "ingredient_nutrient_links_nutrientId_idx" ON "ingredient_nutrient_links"("nutrientId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_nutrient_links_ingredientId_nutrientId_key" ON "ingredient_nutrient_links"("ingredientId", "nutrientId");

-- AddForeignKey
ALTER TABLE "ingredient_nutrient_links" ADD CONSTRAINT "ingredient_nutrient_links_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_nutrient_links" ADD CONSTRAINT "ingredient_nutrient_links_nutrientId_fkey" FOREIGN KEY ("nutrientId") REFERENCES "IngredientNutrients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
