import {
  IsUrl,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

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
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
