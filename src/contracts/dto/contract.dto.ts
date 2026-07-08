import { 
  IsString, 
  IsNumber, 
  IsEnum, 
  IsArray, 
  ValidateNested, 
  IsDateString, 
  IsOptional 
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CommissionType {
  fixed = 'fixed',
  percentage = 'percentage',
}

export class CreatePhaseDto {
  @IsString()
  name!: string;

  @IsDateString() 
  dueDate!: string;

  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  @IsNumber()
  commissionValue!: number;
}

export class CreateContractDto {
  @IsString()
  projectName!: string;

  @IsNumber()
  totalProjectValue!: number;

  @IsString()
  vendorId!: string;

  @IsString()
  companyId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePhaseDto)
  phases!: CreatePhaseDto[];
}

export class GenerateContractPdfDto {
  @IsOptional()
  @IsString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  projectDuration?: string;

  @IsOptional()
  @IsNumber()
  contractValue?: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  governingLaw?: string;
}