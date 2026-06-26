import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SERVICE } from './mail.interface';
import { MailService } from './mail.service';
import { ResendMailAdapter } from './adapters/resend.adapter';
import { NodemailerMailAdapter } from './adapters/nodemailer.adapter';

@Module({
  providers: [
    MailService,
    {
      provide: MAIL_SERVICE,
      useFactory: (config: ConfigService) => {
        const provider = config.get('MAIL_PROVIDER', 'resend');
        if (provider === 'nodemailer') {
          return new NodemailerMailAdapter();
        }
        return new ResendMailAdapter(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailService, MAIL_SERVICE],
})
export class MailModule {}

