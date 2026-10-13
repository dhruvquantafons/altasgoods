import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { isProduction, type Env } from "../../config/env.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Development provider: writes emails to the log instead of sending them. */
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger("Email");
  async send({ to, subject, text }: EmailMessage) {
    this.logger.log(`To ${to}: ${subject}\n${text}`);
  }
}

/** Sends through any SMTP server (Zoho, Brevo, Google Workspace, Amazon SES SMTP and so on). */
export class SmtpEmailProvider implements EmailProvider, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("Email");
  private readonly transport: Transporter;

  constructor(
    private readonly config: Pick<Env, "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_USER" | "SMTP_PASSWORD" | "EMAIL_FROM">,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE ?? config.SMTP_PORT === 465,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
        // never fall back to plain text in production
        requireTLS: isProduction() && !(config.SMTP_SECURE ?? config.SMTP_PORT === 465),
        pool: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
  }

  async send({ to, subject, text, html }: EmailMessage) {
    try {
      await this.transport.sendMail({ from: this.config.EMAIL_FROM, to, subject, text, html });
    } catch (e) {
      this.logger.error(`Could not send "${subject}" to ${to}: ${(e as Error).message}`);
      throw e;
    }
  }

  /** Checks the server and credentials, so a bad setting shows up in the log at startup, not at the first reset. */
  onApplicationBootstrap() {
    this.transport.verify().then(
      () => this.logger.log(`SMTP ready: ${this.config.SMTP_HOST}:${this.config.SMTP_PORT}`),
      (e: Error) => this.logger.error(`SMTP check failed for ${this.config.SMTP_HOST}:${this.config.SMTP_PORT}: ${e.message}. Password reset emails will fail until this is fixed.`),
    );
  }

  onApplicationShutdown() {
    this.transport.close();
  }
}
