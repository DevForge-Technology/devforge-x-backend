import { Injectable, Inject } from '@nestjs/common';
import { MailService as IMailService, MAIL_SERVICE } from './mail.interface';

@Injectable()
export class MailService {
  constructor(@Inject(MAIL_SERVICE) private mailAdapter: IMailService) {}

  async sendVendorCredentials(
    to: string,
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    return this.mailAdapter.sendVendorCredentials(to, name, email, password);
  }

  async sendPasswordReset(
    to: string,
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    return this.mailAdapter.sendPasswordReset(to, name, email, password);
  }


}
