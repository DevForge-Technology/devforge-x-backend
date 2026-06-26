import { IsString, IsOptional } from 'class-validator';

export class UploadReportDto {}

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




