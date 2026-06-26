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
    vendorName: string,
    companyName: string,
    pdfBuffer: Buffer,
    templateId?: string, 
  ): Promise<void> {
    try {
      let htmlContent = `
        <p>Dear ${vendorName || 'Vendor Team'},</p>
        <p>Please find attached the Mutual Non-Disclosure Agreement (NDA) for <strong>${companyName}</strong> for your professional review and electronic signature.</p>
        <p>Kind Regards,</p>
        <p><strong>DevForge Technology</strong></p>
      `;

      if (templateId === 'friendly_casual') {
        htmlContent = `
          <p>Hi ${vendorName || 'Team'}! </p>
          <p>Excited to kick things off together. We've compiled the NDA for <strong>${companyName}</strong>—please check out the attached PDF copies below.</p>
          <p>Best,</p>
          <p><strong>The DevForge Onboarding Team</strong></p>
        `;
      }

      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Mutual Non-Disclosure Agreement (NDA) - ${companyName}`,
        html: htmlContent, 
        attachments: [
          {
            filename: `${companyName}-NDA.pdf`,
            content: pdfBuffer.toString('base64'),
          },
        ],
      });

      this.logger.log(`NDA email sent successfully to ${to} using template: ${templateId || 'default'}`);
    } catch (error) {
      this.logger.error(`Failed to send NDA email to ${to}`, error as Error);
      throw error;
    }
  }
}
