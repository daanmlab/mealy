-- AlterTable
ALTER TABLE "grocery_list_item_sources" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitId" TEXT;

-- AddForeignKey
ALTER TABLE "grocery_list_item_sources" ADD CONSTRAINT "grocery_list_item_sources_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
