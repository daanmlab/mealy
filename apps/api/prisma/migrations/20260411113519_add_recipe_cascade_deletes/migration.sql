-- DropForeignKey
ALTER TABLE "grocery_list_item_sources" DROP CONSTRAINT "grocery_list_item_sources_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "weekly_plan_meals" DROP CONSTRAINT "weekly_plan_meals_recipeId_fkey";

-- AddForeignKey
ALTER TABLE "weekly_plan_meals" ADD CONSTRAINT "weekly_plan_meals_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_item_sources" ADD CONSTRAINT "grocery_list_item_sources_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
