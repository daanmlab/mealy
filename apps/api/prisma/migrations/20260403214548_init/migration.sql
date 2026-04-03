-- CreateEnum
CREATE TYPE "FoodGoal" AS ENUM ('easy', 'healthy', 'cheap', 'high_protein');

-- CreateEnum
CREATE TYPE "CookTimePreference" AS ENUM ('under20', 'under40', 'any');

-- CreateEnum
CREATE TYPE "RecipeTag" AS ENUM ('pasta', 'rice', 'bowl', 'stir_fry', 'salad', 'soup', 'sheet_pan', 'quick', 'healthy', 'cheap', 'high_protein', 'vegetarian', 'vegan');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('produce', 'meat', 'seafood', 'dairy', 'grains', 'canned', 'condiments', 'spices', 'frozen', 'other');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "password" TEXT,
    "peopleCount" INTEGER NOT NULL DEFAULT 2,
    "mealsPerWeek" INTEGER NOT NULL DEFAULT 5,
    "cookTime" "CookTimePreference" NOT NULL DEFAULT 'any',
    "goal" "FoodGoal" NOT NULL DEFAULT 'healthy',
    "dislikes" TEXT[],
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL DEFAULT 'other',

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cookTimeMinutes" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 2,
    "imageUrl" TEXT,
    "tags" "RecipeTag"[],
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_plan_meals" (
    "id" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "weekly_plan_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_lists" (
    "id" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grocery_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_list_items" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "grocery_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_recipes" (
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_recipes_pkey" PRIMARY KEY ("userId","recipeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ingredients_recipeId_ingredientId_key" ON "recipe_ingredients"("recipeId", "ingredientId");

-- CreateIndex
CREATE INDEX "weekly_plans_userId_idx" ON "weekly_plans"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_plan_meals_weeklyPlanId_day_key" ON "weekly_plan_meals"("weeklyPlanId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "grocery_lists_weeklyPlanId_key" ON "grocery_lists"("weeklyPlanId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan_meals" ADD CONSTRAINT "weekly_plan_meals_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan_meals" ADD CONSTRAINT "weekly_plan_meals_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "weekly_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "grocery_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_recipes" ADD CONSTRAINT "favorite_recipes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_recipes" ADD CONSTRAINT "favorite_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
