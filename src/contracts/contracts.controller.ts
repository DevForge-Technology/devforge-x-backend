import { Controller, Post, Body, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ContractsService } from './contracts.service';
import { CreateContractDto, GenerateContractPdfDto } from './dto/contract.dto';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractsService.createContract(createContractDto);
  }

  @Get('company/:companyId')
  findByCompany(@Param('companyId') companyId: string) {
    return this.contractsService.findAllByCompany(companyId);
  }

  @Get('vendor/:vendorId')
  findByVendor(@Param('vendorId') vendorId: string) {
    return this.contractsService.findAllByVendor(vendorId);
  }

  @Post(':companyId/pdf')
  async downloadContractPdf(
    @Param('companyId') companyId: string,
    @Body() dto: GenerateContractPdfDto,
    @Res() res: Response,
  ) {
    const pdfStream = await this.contractsService.generateContractPdf(companyId, dto);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contract-${companyId}.pdf"`,
    });

    pdfStream.pipe(res);
  }
}