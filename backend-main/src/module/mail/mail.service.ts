import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

type SupportTicketMail = {
  to: string;
  customerName?: string | null;
  ticketNumber: string;
  subject: string;
};

type SupportReplyMail = SupportTicketMail & {
  message: string;
};

type SupportStatusMail = SupportTicketMail & {
  status: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getRequired(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is not configured`);
    }

    return value;
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.getRequired('SMTP_HOST');
    const port = Number(this.getRequired('SMTP_PORT'));
    const user = this.getRequired('SMTP_USER');
    const pass = this.getRequired('SMTP_PASS');

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error('SMTP_PORT is invalid');
    }

    const secure =
      process.env.SMTP_SECURE?.trim().toLowerCase() === 'true' || port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private getFrom(): string {
    const address =
      process.env.MAIL_FROM?.trim() || this.getRequired('SMTP_USER');

    const name =
      process.env.MAIL_FROM_NAME?.trim() || 'Astro Soul Path Customer Care';

    return `"${name}" <${address}>`;
  }

  async verifyConnection(): Promise<void> {
    const transporter = this.getTransporter();

    await transporter.verify();

    this.logger.log('SMTP connection verified');
  }

  async sendSupportTicketCreated(input: SupportTicketMail): Promise<void> {
    const transporter = this.getTransporter();

    const name = input.customerName?.trim() || 'Customer';

    await transporter.sendMail({
      from: this.getFrom(),
      to: input.to,
      subject: `[${input.ticketNumber}] We received your support request`,
      text: [
        `Hi ${name},`,
        '',
        `Your request (${input.ticketNumber}) has been received.`,
        '',
        `Subject: ${input.subject}`,
        '',
        'Our support team will review your query and reply to you.',
        '',
        'You can also track the same ticket inside Astro Soul Path.',
        '',
        'Thank you,',
        'Astro Soul Path Customer Care',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <p>Hi ${this.escapeHtml(name)},</p>

          <p>
            Your request
            <strong>${this.escapeHtml(input.ticketNumber)}</strong>
            has been received.
          </p>

          <p>
            <strong>Subject:</strong>
            ${this.escapeHtml(input.subject)}
          </p>

          <p>
            Our support team will review your query and reply to you.
          </p>

          <p>
            You can also track the same ticket inside Astro Soul Path.
          </p>

          <p>
            Thank you,<br>
            <strong>Astro Soul Path Customer Care</strong>
          </p>
        </div>
      `,
    });
  }

  async sendSupportAdminReply(input: SupportReplyMail): Promise<void> {
    const transporter = this.getTransporter();

    const name = input.customerName?.trim() || 'Customer';

    await transporter.sendMail({
      from: this.getFrom(),
      to: input.to,
      subject: `[${input.ticketNumber}] Your support request has been updated`,
      text: [
        `Hi ${name},`,
        '',
        `Your support request (${input.ticketNumber}) has been updated.`,
        '',
        input.message,
        '',
        'You can reply from Astro Soul Path to continue the same ticket.',
        '',
        'Thank you,',
        'Astro Soul Path Customer Care',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <p>Hi ${this.escapeHtml(name)},</p>

          <p>
            Your support request
            <strong>${this.escapeHtml(input.ticketNumber)}</strong>
            has been updated.
          </p>

          <div
            style="
              padding:14px;
              border-left:4px solid #999;
              background:#f7f7f7;
              white-space:pre-wrap;
            "
          >${this.escapeHtml(input.message)}</div>

          <p>
            You can reply from Astro Soul Path to continue the same ticket.
          </p>

          <p>
            Thank you,<br>
            <strong>Astro Soul Path Customer Care</strong>
          </p>
        </div>
      `,
    });
  }

  async sendSupportStatusChanged(input: SupportStatusMail): Promise<void> {
    const transporter = this.getTransporter();

    const name = input.customerName?.trim() || 'Customer';

    const readableStatus = input.status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

    await transporter.sendMail({
      from: this.getFrom(),
      to: input.to,
      subject: `[${input.ticketNumber}] Support request ${readableStatus}`,
      text: [
        `Hi ${name},`,
        '',
        `Your support request (${input.ticketNumber}) status is now: ${readableStatus}.`,
        '',
        `Subject: ${input.subject}`,
        '',
        'Thank you,',
        'Astro Soul Path Customer Care',
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <p>Hi ${this.escapeHtml(name)},</p>

          <p>
            Your support request
            <strong>${this.escapeHtml(input.ticketNumber)}</strong>
            status is now
            <strong>${this.escapeHtml(readableStatus)}</strong>.
          </p>

          <p>
            <strong>Subject:</strong>
            ${this.escapeHtml(input.subject)}
          </p>

          <p>
            Thank you,<br>
            <strong>Astro Soul Path Customer Care</strong>
          </p>
        </div>
      `,
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
