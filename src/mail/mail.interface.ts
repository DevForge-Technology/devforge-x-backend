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
}

export const MAIL_SERVICE = 'MAIL_SERVICE';
