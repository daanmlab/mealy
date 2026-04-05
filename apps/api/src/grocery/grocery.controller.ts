import { Controller, Post, Get, Patch, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GroceryService } from './grocery.service';

@Controller('plans/:planId/grocery')
@UseGuards(JwtAuthGuard)
export class GroceryController {
  constructor(private readonly grocery: GroceryService) {}

  @Post()
  generate(@Param('planId') planId: string, @CurrentUser() user: User) {
    return this.grocery.generateList(planId, user);
  }

  @Get()
  getList(@Param('planId') planId: string, @CurrentUser() user: User) {
    return this.grocery.getList(planId, user.id);
  }

  @Patch('items/:itemId/toggle')
  toggleItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: User,
  ) {
    return this.grocery.toggleItem(planId, itemId, user.id);
  }
}
