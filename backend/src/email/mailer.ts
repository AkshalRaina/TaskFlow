import nodemailer from 'nodemailer';
import { config } from '../config';

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** In tests, emails are collected here instead of being sent, so tests can read the invite links. */
export const testOutbox: Email[] = [];

// Only create a real SMTP connection when a mail server is configured.
const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

/**
 * Sends an email:
 *   - tests:            stored in `testOutbox`
 *   - no SMTP_HOST set: printed to the console (handy in local development)
 *   - otherwise:        sent through the SMTP server
 */
export async function sendEmail(email: Email): Promise<void> {
  if (config.isTest) {
    testOutbox.push(email);
    return;
  }

  if (!transporter) {
    console.log(`\n📧 Email (not sent: SMTP_HOST is not set)\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return;
  }

  await transporter.sendMail({ from: config.emailFrom, ...email });
}
