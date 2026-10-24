import nodemailer from 'nodemailer';
import { config, mailConfigured } from '../config.js';

let transport = null;
// Sans SMTP configuré, aucun e-mail n'est envoyé : on le dit, on ne simule pas.
export async function sendMail({ to, subject, text }) {
  if (!mailConfigured()) {
    if (!config.isProd) console.log(`[mail non configuré] à=${to} sujet="${subject}"\n${text}\n`);
    return { sent: false, reason: 'smtp_not_configured' };
  }
  transport ||= nodemailer.createTransport(config.smtp.url);
  await transport.sendMail({ from: config.smtp.from, to, subject, text });
  return { sent: true };
}
