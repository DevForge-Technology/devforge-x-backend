import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailService } from '../mail.interface';
import { vendorCredentialsTemplate, passwordResetTemplate } from '../templates/credentials.template';

@Injectable()
export class ResendMailAdapter implements MailService {
  private readonly logger = new Logger(ResendMailAdapter.name);
  private resend: Resend;
  private from: string;
  private portalUrl: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.getOrThrow('RESEND_API_KEY'));
    this.from = this.config.get('MAIL_FROM', 'DevForge[x] <noreply@devforgex.app>');
    this.portalUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  async sendVendorCredentials(to: string, name: string, email: string, password: string) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Your DevForge[x] vendor credentials',
        html: vendorCredentialsTemplate(name, email, password, this.portalUrl),
      });
      this.logger.log(`Vendor credentials email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send vendor credentials email to ${to}`, error as Error);
      throw error;
    }
  }

  async sendPasswordReset(to: string, name: string, email: string, password: string) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Your DevForge[x] password has been reset',
        html: passwordResetTemplate(name, email, password),
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error as Error);
      throw error;
    }
  }
  async sendNdaEmail(
  to: string,
  message: string,
  pdfBuffer: Buffer,
): Promise<void> { console.log(message);
  try {
    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Mutual Non-Disclosure Agreement (NDA)',
      html: message,
      attachments: [
        {
          filename: 'NDA.pdf',
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    this.logger.log(`NDA email sent successfully to ${to}`);
  } catch (error) {
    this.logger.error(`Failed to send NDA email to ${to}`, error as Error);
    throw error;
  }
}
}
