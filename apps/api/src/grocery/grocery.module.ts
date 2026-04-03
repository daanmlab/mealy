import { Module } from '@nestjs/common';
import { GroceryService } from './grocery.service';
import { GroceryController } from './grocery.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule],
  providers: [GroceryService],
  controllers: [GroceryController],
})
export class GroceryModule {}
