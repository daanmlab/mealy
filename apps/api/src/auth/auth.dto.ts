import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

const normalizeEmail = ({ value }: { value: string }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class ValidateCredentialsDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class UpsertOAuthUserDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
