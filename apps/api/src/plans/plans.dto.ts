import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { DayOfWeek } from '@prisma/client';

export class CreatePlanDto {
  @IsOptional()
  @IsDateString()
  weekStart?: string;
}

export class SwapMealDto {
  @IsOptional()
  @IsString()
  recipeId?: string;
}

export class LockMealDto {
  @IsEnum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  day: DayOfWeek;
}
