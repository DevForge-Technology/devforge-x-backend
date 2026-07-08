import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ReportType } from '@prisma/client';

export class UploadReportDto {
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;
}

export class SendReportDto {
  @IsString()
  reportId!: string;

  @IsString()
  vendorEmail!: string;

  @IsOptional()
  @IsString()
  emailContent?: string;
}

export class ReportResponseDto {
  id!: string;
  type!: ReportType;
  status!: string;
  fileUrl!: string;
  fileName!: string;
  fileType!: string;
  fileSize!: number;
  vendorId!: string;
  companyId!: string;
  sentToEmail?: string;
  sentAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
}