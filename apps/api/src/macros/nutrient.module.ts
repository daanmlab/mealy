import { Module } from '@nestjs/common';
import { NutrientService } from './nutrient.service';

@Module({
  providers: [NutrientService],
  exports: [NutrientService],
})
export class NutrientModule {}
