import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  designation!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyIds?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyIds?: string[];
}

export class UpdateMeDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  new_password!: string;
}
