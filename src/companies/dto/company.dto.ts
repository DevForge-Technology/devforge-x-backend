import { Optional } from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsMongoId, IsEmail } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @IsOptional()
  @IsString()
  @IsMongoId()
  vendorId?: string;
}

export class UpdateCompanyDto extends CreateCompanyDto {}

export class AssignVendorDto {
  @IsMongoId()
  vendorId!: string;
}

export class UpdateWorkspaceDto {
  @IsMongoId()
  companyId!: string;
}

export class SendNdaDto {
  @IsEmail()
  email!: string;

  @Optional()
  @IsString()
  message!: string;
}