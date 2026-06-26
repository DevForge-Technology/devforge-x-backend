import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CloudinaryService } from '../common/services/cloudinary.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [ReportsController],
  providers: [ReportsService, CloudinaryService, AuthGuard, RolesGuard],
})
export class ReportsModule {}

