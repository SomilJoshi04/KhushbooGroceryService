/**
 * Email Service — KhushbooFoodService
 *
 * Implements:
 * - Configurable SMTP email dispatch via nodemailer.
 * - Branded, responsive HTML email templates for Email Verification,
 *   Password Reset, and Security Alerts.
 * - Local development console dispatch fallback when SMTP is unconfigured.
 * - Plaintext fallbacks for text-only email clients.
 *
 * @module services/emailService
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporterInstance = null;

/**
 * Returns or initializes the nodemailer transport.
 */
function getTransporter() {
  if (transporterInstance) {
    return transporterInstance;
  }

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporterInstance = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: Boolean(env.SMTP_SECURE),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  return transporterInstance;
}

/**
 * Common HTML email shell with KhushbooFoodService branding.
 */
function renderEmailShell({ title, subtitle, contentHtml, previewText = '' }) {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F9FA;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1F2937;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #FFFFFF;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #E5E7EB;
    }
    .header {
      background: #1B4332;
      padding: 32px 24px;
      text-align: center;
      color: #FFFFFF;
    }
    .logo-badge {
      display: inline-block;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #FFFFFF;
      margin-bottom: 4px;
    }
    .tagline {
      font-size: 12px;
      color: #D4A373;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .content {
      padding: 36px 32px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-top: 0;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 24px;
    }
    .button-container {
      margin: 32px 0;
      text-align: center;
    }
    .btn-primary {
      display: inline-block;
      background-color: #1B4332;
      color: #FFFFFF !important;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(27, 67, 50, 0.25);
    }
    .notice-box {
      background-color: #FEF3C7;
      border-left: 4px solid #D97706;
      padding: 14px 16px;
      border-radius: 6px;
      font-size: 13px;
      color: #92400E;
      margin: 24px 0;
    }
    .security-notice {
      border-top: 1px solid #F3F4F6;
      padding-top: 20px;
      font-size: 12px;
      color: #9CA3AF;
      line-height: 1.5;
    }
    .footer {
      background-color: #F9FAFB;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
    }
    .footer a {
      color: #1B4332;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${previewText ? `<div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</div>` : ''}
  <div class="container">
    <div class="header">
      <div class="logo-badge">Khushboo <span style="color:#D4A373">Grocery</span></div>
      <div class="tagline">Pure & Fresh Daily Essentials • Indore</div>
    </div>
    <div class="content">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
      ${contentHtml}
      <div class="security-notice">
        <strong>Security Notice:</strong> KhushbooFoodService staff will never ask you for your password or sensitive verification links. If you did not initiate this request, no further action is required and your account remains secure.
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} Khushboo Food Service. All rights reserved.</p>
      <p>Indore, Madhya Pradesh, India • <a href="${env.FRONTEND_URL}/help">Customer Support</a> • <a href="${env.FRONTEND_URL}/privacy-policy">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Dispatches an email, falling back to safe local console simulation in development.
 */
async function sendMail({ to, subject, html, text }) {
  const from = `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`;
  const transporter = getTransporter();

  if (!transporter) {
    if (env.NODE_ENV === 'production') {
      console.error(`[email:prod] ❌ SMTP not configured. Cannot deliver email to: ${to}`);
      throw new Error('Email service is currently unconfigured. Please contact support.');
    }

    // In development / testing: log the simulated email with full link for instant clicking
    console.info(`\n╔═══════════════════════════════════════════════════════════════════╗`);
    console.info(`║ 📧 [DEV EMAIL SIMULATION]                                        ║`);
    console.info(`║ To: ${to.padEnd(59)}║`);
    console.info(`║ Subject: ${subject.padEnd(54)}║`);
    console.info(`╚═══════════════════════════════════════════════════════════════════╝`);
    console.info(text || html);
    console.info(`═════════════════════════════════════════════════════════════════════\n`);

    return {
      success: true,
      simulated: true,
      messageId: `dev-sim-${Date.now()}`,
    };
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    success: true,
    messageId: info.messageId,
  };
}

/**
 * Sends an email verification link to a customer.
 *
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} rawToken
 */
export async function sendVerificationEmail(toEmail, toName, rawToken) {
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const contentHtml = `
    <p>Hello ${toName || 'Valued Customer'},</p>
    <p>Welcome to <strong>Khushboo Food Service</strong>! Please confirm your email address to activate your account and start shopping for pure, farm-fresh groceries.</p>
    <div class="button-container">
      <a href="${verifyUrl}" class="btn-primary" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
    </div>
    <div class="notice-box">
      ⏰ <strong>Important:</strong> This verification link is valid for <strong>30 minutes</strong> and can only be used once.
    </div>
    <p style="font-size: 13px; color: #4B5563;">If the button above does not work, copy and paste this link into your web browser:</p>
    <p style="font-size: 12px; word-break: break-all; color: #1B4332;"><a href="${verifyUrl}">${verifyUrl}</a></p>
  `;

  const text = `Hello ${toName || 'Valued Customer'},\n\nPlease verify your email address for Khushboo Food Service by clicking the link below:\n${verifyUrl}\n\nThis link expires in 30 minutes. If you did not create this account, please ignore this email.`;

  return sendMail({
    to: toEmail,
    subject: 'Verify your Khushboo Food Service Account',
    html: renderEmailShell({
      title: 'Verify Your Email Address',
      subtitle: 'Complete your registration to unlock fresh grocery delivery in Indore.',
      contentHtml,
      previewText: 'Click here to verify your Khushboo Grocery account.',
    }),
    text,
  });
}

/**
 * Sends a password reset link to a customer.
 *
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} rawToken
 */
export async function sendPasswordResetEmail(toEmail, toName, rawToken) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const contentHtml = `
    <p>Hello ${toName || 'Valued Customer'},</p>
    <p>We received a request to reset the password for your <strong>Khushboo Food Service</strong> account.</p>
    <div class="button-container">
      <a href="${resetUrl}" class="btn-primary" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
    </div>
    <div class="notice-box">
      ⏰ <strong>Notice:</strong> This link will expire in <strong>15 minutes</strong> for your security.
    </div>
    <p style="font-size: 13px; color: #4B5563;">If the button above does not work, copy and paste this URL into your browser:</p>
    <p style="font-size: 12px; word-break: break-all; color: #1B4332;"><a href="${resetUrl}">${resetUrl}</a></p>
  `;

  const text = `Hello ${toName || 'Valued Customer'},\n\nWe received a request to reset your Khushboo Food Service account password. Use the link below to set a new password:\n${resetUrl}\n\nThis link expires in 15 minutes. If you did not request a password reset, your account is secure and you may safely ignore this message.`;

  return sendMail({
    to: toEmail,
    subject: 'Reset your Khushboo Food Service Password',
    html: renderEmailShell({
      title: 'Password Reset Request',
      subtitle: 'Follow the link below to create a new secure password.',
      contentHtml,
      previewText: 'Password reset request for your Khushboo Grocery account.',
    }),
    text,
  });
}

/**
 * Sends an email notification after successful password reset.
 *
 * @param {string} toEmail
 * @param {string} toName
 */
export async function sendPasswordChangedNotification(toEmail, toName) {
  const contentHtml = `
    <p>Hello ${toName || 'Valued Customer'},</p>
    <p>This is a confirmation that the password for your <strong>Khushboo Food Service</strong> account was successfully changed.</p>
    <p>All previous active login sessions on other devices have been automatically signed out as a safety precaution.</p>
    <div class="notice-box">
      ⚠️ <strong>Didn't make this change?</strong> If you did not change your password, please contact our support team immediately at <a href="${env.FRONTEND_URL}/help">Khushboo Help Center</a> to secure your account.
    </div>
  `;

  const text = `Hello ${toName || 'Valued Customer'},\n\nYour Khushboo Food Service account password was successfully changed. All other device sessions have been revoked.\n\nIf you did not perform this change, please contact support immediately.`;

  return sendMail({
    to: toEmail,
    subject: 'Security Alert: Your Khushboo Account Password Was Changed',
    html: renderEmailShell({
      title: 'Password Changed Successfully',
      subtitle: 'Your account security has been updated.',
      contentHtml,
      previewText: 'Your Khushboo Food Service account password has been changed.',
    }),
    text,
  });
}

