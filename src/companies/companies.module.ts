import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, AuthGuard, RolesGuard],
})
export class CompaniesModule {}
