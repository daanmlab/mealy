import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RecipeTag } from '@prisma/client';

export class RecipeQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: RecipeTag | RecipeTag[] }) =>
    Array.isArray(value) ? value : [value],
  )
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
