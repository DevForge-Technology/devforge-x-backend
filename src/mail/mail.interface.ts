export interface MailService {
  sendVendorCredentials(
    to: string,
    name: string,
    email: string,
    password: string,
  ): Promise<void>;

  sendPasswordReset(
    to: string,
    name: string,
    email: string,
    password: string,
  ): Promise<void>;

 sendNdaEmail(
    to: string,
    vendorName: string,
    companyName: string,
    pdfBuffer: Buffer,
    templateId?: string,
  ): Promise<void>;
}
export const MAIL_SERVICE = 'MAIL_SERVICE';
