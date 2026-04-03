import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RecipeTag } from '@prisma/client';

export class RecipeQueryDto {
  @IsOptional()
  @IsEnum(RecipeTag, { each: true })
  tags?: RecipeTag[];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(120)
  maxCookTime?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
