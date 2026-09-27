import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppConfig } from '../../config/app-config.js';

import type { RenderedEmail } from './email-templates.js';

/**
 * Outbound email. Used only by the email worker — requests enqueue emails and
 * never talk to SMTP directly, so slow or failing mail servers are retried
 * with backoff instead of slowing users down.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: AppConfig) {
    const { mail } = config;
    this.transporter =
      mail.transport === 'smtp'
        ? nodemailer.createTransport({
            host: mail.host,
            port: mail.port,
            secure: mail.secure,
            ...(mail.user ? { auth: { user: mail.user, pass: mail.password ?? '' } } : {}),
            pool: true,
            connectionTimeout: 10_000,
            socketTimeout: 20_000,
          })
        : null;
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  async send(to: string, email: RenderedEmail): Promise<void> {
    if (!this.transporter) {
      // Development transport: log the message (including links) instead of sending it.
      this.logger.log(`[mail:log] To: ${to} | Subject: ${email.subject}\n${email.text}`);
      return;
    }
    await this.transporter.sendMail({
      from: this.config.mail.from,
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }
}
