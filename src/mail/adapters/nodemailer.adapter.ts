import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail.interface';

@Injectable()
export class NodemailerMailAdapter implements MailService {
  private readonly logger = new Logger(NodemailerMailAdapter.name);

  async sendVendorCredentials(to: string, name: string, email: string, password: string) {
    this.logger.warn(`Nodemailer adapter not configured. Would send credentials to ${to}`);
    this.logger.debug({ name, email, password });
  }

  async sendPasswordReset(to: string, name: string, email: string, password: string) {
    this.logger.warn(`Nodemailer adapter not configured. Would send password reset to ${to}`);
    this.logger.debug({ name, email, password });
  }
}
