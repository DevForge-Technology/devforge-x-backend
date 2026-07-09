import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('upload/:companyId')
  @Roles(Role.vendor)
  @UseInterceptors(FileInterceptor('file'))
  async uploadReport(
    @CurrentUser() user: User,
    @Param('companyId') companyId: string,
    @UploadedFile() file: any,
    @Body('type') type: 'GENERAL' | 'NDA' = 'GENERAL',
    @Body('reportId') reportId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, DOC, and DOCX files are allowed');
    }

    return this.reportsService.uploadReport(user.id, companyId, file, type, reportId);
  }

  @Get('company/:companyId')
  async getCompanyReports(
    @CurrentUser() user: User,
    @Param('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('type') type?: 'GENERAL' | 'NDA',
  ) {
    return this.reportsService.getCompanyReports(
      user.id,
      user.role,
      companyId,
      type,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }
  @Get('nda/:companyId')
  @Roles(Role.vendor)
  async getCompanyNdaReports(
    @CurrentUser() user: User,
    @Param('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.reportsService.getCompanyReports(
      user.id,
      user.role,
      companyId,
      'NDA',
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  @Delete(':id')
  @Roles(Role.vendor)
  async deleteReport(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('action') action?: 'reset' | 'delete',
  ) {
    if (action === 'reset') {
      return this.reportsService.resetReport(user.id, id);
    }
    return this.reportsService.deleteReport(user.id, id);
  }
}