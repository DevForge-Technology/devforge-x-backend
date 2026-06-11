import { IsArray, IsEmail, IsOptional, IsString, IsMongoId } from 'class-validator';

export class CreateReferralDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  productInfo!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceLinks?: string[];

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsEmail()
  hostEmail?: string;

  @IsOptional()
  @IsMongoId()
  companyId?: string;
}

export class UpdateReferralDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  productInfo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceLinks?: string[];

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsEmail()
  hostEmail?: string;
}
