import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Role } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { AssignVendorDto, CreateCompanyDto, UpdateCompanyDto, UpdateWorkspaceDto } from './dto/company.dto';

@Controller('companies')
@UseGuards(AuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('mine')
  @Roles(Role.vendor)
  getMine(@CurrentUser() user: User) {
    return this.companiesService.getMine(user.id);
  }

  @Patch('workspace')
  @Roles(Role.vendor)
  updateWorkspace(
    @CurrentUser() user: User,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: { supabaseToken?: string },
  ) {
    return this.companiesService.updateWorkspace(user.id, user.supabaseId, dto.companyId);
  }

  @Get()
  @Roles(Role.admin)
  list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.companiesService.list(
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Post()
  @Roles(Role.admin)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get(':id')
  @Roles(Role.admin)
  getById(@Param('id') id: string) {
    return this.companiesService.getById(id);
  }

  @Put(':id')
  @Roles(Role.admin)
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  delete(@Param('id') id: string) {
    return this.companiesService.delete(id);
  }

  @Post(':id/assign')
  @Roles(Role.admin)
  assign(@Param('id') id: string, @Body() dto: AssignVendorDto) {
    return this.companiesService.assignVendor(id, dto.vendorId);
  }

  @Delete(':id/unassign/:vendorId')
  @Roles(Role.admin)
  unassign(@Param('id') id: string, @Param('vendorId') vendorId: string) {
    return this.companiesService.unassignVendor(id, vendorId);
  }
  @Post(':id/generate-nda')
  @Roles(Role.admin)
  async generateNda(@Param('id') id: string, @Res() res: Response) {
    const pdfStream = await this.companiesService.generateNdaPdf(id);

    // Set headers explicitly to tell the browser it's a binary PDF download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=NDA_${id}.pdf`,
    });

    // Pipe the readable stream directly into the express response network pipeline
    pdfStream.pipe(res);
  }
}
