import {
  IsInt,
  IsEnum,
  IsArray,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { CookTimePreference, FoodGoal } from '@prisma/client';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  peopleCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  mealsPerWeek?: number;

  @IsOptional()
  @IsEnum(CookTimePreference)
  cookTime?: CookTimePreference;

  @IsOptional()
  @IsEnum(FoodGoal)
  goal?: FoodGoal;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dislikes?: string[];

  @IsOptional()
  @IsBoolean()
  onboardingDone?: boolean;
}
