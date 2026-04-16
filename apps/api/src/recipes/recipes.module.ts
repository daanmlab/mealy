import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { NutrientModule } from '../macros/nutrient.module';

@Module({
  imports: [CatalogModule, NutrientModule],
  providers: [RecipesService],
  controllers: [RecipesController],
  exports: [RecipesService],
})
export class RecipesModule {}
