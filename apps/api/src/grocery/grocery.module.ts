import { Module } from '@nestjs/common';
import { GroceryService } from './grocery.service';
import { GroceryController } from './grocery.controller';
import { PlansModule } from '../plans/plans.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [PlansModule, CatalogModule],
  providers: [GroceryService],
  controllers: [GroceryController],
})
export class GroceryModule {}
