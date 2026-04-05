-- CreateTable
CREATE TABLE "grocery_list_item_sources" (
    "id" TEXT NOT NULL,
    "groceryListItemId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,

    CONSTRAINT "grocery_list_item_sources_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "grocery_list_item_sources" ADD CONSTRAINT "grocery_list_item_sources_groceryListItemId_fkey" FOREIGN KEY ("groceryListItemId") REFERENCES "grocery_list_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_list_item_sources" ADD CONSTRAINT "grocery_list_item_sources_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
