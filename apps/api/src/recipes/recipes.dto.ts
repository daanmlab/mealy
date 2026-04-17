import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class RecipeQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string | string[] }) =>
    Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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

export class CreateRecipeIngredientDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  unitSymbol!: string;

  @IsString()
  @IsNotEmpty()
  categorySlug!: string;

  @IsOptional()
  @IsString()
  groupName?: string;
}

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  @Max(600)
  cookTimeMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  servings!: number;

  // TODO: Implement image upload and remove imageUrl
  // @IsOptional()
  // @IsUrl()
  // imageUrl?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsArray()
  @IsString({ each: true })
  tagSlugs!: string[];

  @IsArray()
  steps!: { order: number; text: string }[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients!: CreateRecipeIngredientDto[];

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
