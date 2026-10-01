import { Logger } from "@nestjs/common";

export interface SmsProvider {
  /** Sends a sign in code. Real providers must use a DLT registered template. */
  sendOtp(phone: string, code: string): Promise<void>;
}

export interface EmailProvider {
  sendOtp(email: string, code: string): Promise<void>;
  /** Transactional notice, for example an onboarding decision. */
  send(email: string, subject: string, body: string): Promise<void>;
}

/** Development provider: logs the code instead of sending an SMS. */
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger("SMS");
  async sendOtp(phone: string, code: string) {
    this.logger.log(`OTP for ${phone}: ${code}`);
  }
}

/** Development provider: logs emails instead of sending them. */
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger("Email");
  async sendOtp(email: string, code: string) {
    this.logger.log(`Verification code for ${email}: ${code}`);
  }
  async send(email: string, subject: string, body: string) {
    this.logger.log(`To ${email}: ${subject}. ${body}`);
  }
}
