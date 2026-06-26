import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { ReferralsModule } from './referrals/referrals.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    SupabaseModule,
    MailModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ReferralsModule,
    ReportsModule,
  ],
})
export class AppModule {}

