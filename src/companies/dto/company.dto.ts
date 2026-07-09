import { Optional } from '@nestjs/common';
import { CompanyStatus } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsMongoId, IsEmail, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

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

export class GenerateAgreementDto {
  
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  scheduleNo?: string;

  @IsOptional()
  @IsString()
  scheduleDate?: string;

  @IsOptional()
  @IsString()
  referredClient?: string;

  @IsOptional()
  @IsString()
  engagementName?: string;

  @IsOptional()
  @IsString()
  scopeSummary?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalClientContractValue?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  numberOfProgressPayments?: number;

  @IsOptional()
  @IsString()
  expectedEngagementStart?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalReferralFee?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  numberOfInstalments?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  instalmentAmount?: number;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  bsbAccount?: string;
}

