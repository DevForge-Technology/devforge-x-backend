import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MailModule } from '../mail/mail.module';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [MailModule],
  controllers: [UsersController],
  providers: [UsersService, AuthGuard, RolesGuard],
})
export class UsersModule {}
