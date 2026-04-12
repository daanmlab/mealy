import {
  IsUrl,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportUrlDto {
  @IsUrl()
  @IsNotEmpty()
  url!: string;
}

export class UpdateRecipeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  cookTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  servings?: number;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRecipeIngredientDto {
  @IsOptional()
  @IsString()
  ingredientId?: string;

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

export class RecipeStepDto {
  @IsInt()
  @Min(1)
  order!: number;

  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class RenameTagDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateRecipeFullDto extends UpdateRecipeDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps?: RecipeStepDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagSlugs?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRecipeIngredientDto)
  ingredients?: UpdateRecipeIngredientDto[];
}
