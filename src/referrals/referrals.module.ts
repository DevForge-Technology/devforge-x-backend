import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, AuthGuard, RolesGuard],
})
export class ReferralsModule {}
