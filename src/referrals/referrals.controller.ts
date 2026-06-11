import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { CreateReferralDto, UpdateReferralDto } from './dto/referral.dto';

@Controller('referrals')
@UseGuards(AuthGuard, RolesGuard)
export class ReferralsController {
  constructor(private referralsService: ReferralsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: User) {
    return this.referralsService.getDashboardStats(
      user.role,
      user.id,
      user.lastUsedCompanyId,
    );
  }

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('company_id') companyId?: string,
    @Query('vendor_id') vendorId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.referralsService.list(user.id, user.role, {
      companyId,
      vendorId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      lastUsedCompanyId: user.lastUsedCompanyId,
    });
  }

  @Post()
  @Roles(Role.vendor,Role.admin)
  create(@CurrentUser() user: User, @Body() dto: CreateReferralDto) {
    return this.referralsService.create(user.id, user.lastUsedCompanyId, dto);
  }

  @Get(':id')
  getById(@CurrentUser() user: User, @Param('id') id: string) {
    return this.referralsService.getById(id, user.id, user.role);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateReferralDto,
  ) {
    return this.referralsService.update(id, user.id, user.role, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.referralsService.delete(id, user.id, user.role);
  }
}
