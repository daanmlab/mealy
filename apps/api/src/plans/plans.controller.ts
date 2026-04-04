import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto, SwapMealDto } from './plans.dto';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePlanDto) {
    const weekStart = dto.weekStart ? new Date(dto.weekStart) : undefined;
    return this.plans.createPlan(user, weekStart);
  }

  @Get('current')
  getCurrent(
    @CurrentUser() user: User,
    @Query('weekStart') weekStart?: string,
  ) {
    const weekStartDate = weekStart ? new Date(weekStart) : undefined;
    return this.plans.getCurrentPlan(user.id, weekStartDate);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: User) {
    return this.plans.getPlanById(id, user.id);
  }

  @Patch(':id/meals/:mealId/swap')
  swapMeal(
    @Param('id') planId: string,
    @Param('mealId') mealId: string,
    @CurrentUser() user: User,
    @Body() dto: SwapMealDto,
  ) {
    return this.plans.swapMeal(planId, mealId, user.id, dto.recipeId);
  }

  @Patch(':id/meals/:mealId/lock')
  toggleLock(
    @Param('id') planId: string,
    @Param('mealId') mealId: string,
    @CurrentUser() user: User,
  ) {
    return this.plans.toggleLock(planId, mealId, user.id);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.plans.confirmPlan(id, user.id);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string, @CurrentUser() user: User) {
    return this.plans.regeneratePlan(id, user);
  }

  @Post(':id/unlock')
  unlock(@Param('id') id: string, @CurrentUser() user: User) {
    return this.plans.unlockPlan(id, user.id);
  }
}
