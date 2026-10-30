import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Lazily created — building a transport with empty SMTP_HOST would fail
// immediately, and most local/demo runs never send real email at all.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

// No SMTP_HOST configured -> log the link instead of sending, so the
// forgot-password flow is demoable without real email credentials.
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[emailService] SMTP not configured — password reset link for ${to}:\n  ${resetLink}`);
    return;
  }

  await t.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your CyberLearn password',
    text: `We received a request to reset your CyberLearn password. This link expires in 30 minutes:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your CyberLearn password. This link expires in 30 minutes:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}
