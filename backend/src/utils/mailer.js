import nodemailer from 'nodemailer';
import logger from './logger.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (not your regular password)
  },
});

const FROM = process.env.EMAIL_FROM || `"Meetix" <${process.env.EMAIL_USER}>`;

/**
 * Sends an OTP email for either email verification or password reset.
 * @param {string} to - recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {'verify' | 'reset'} type
 */
export const sendOtpEmail = async (to, otp, type) => {
  const isVerify = type === 'verify';

  const subject = isVerify
    ? '✅ Verify Your Meetix Account'
    : '🔐 Meetix Password Reset OTP';

  const title = isVerify ? 'Verify Your Email' : 'Reset Your Password';
  const desc = isVerify
    ? 'You recently signed up for Meetix. Use the OTP below to verify your email address.'
    : 'You requested to reset your Meetix password. Use the OTP below to proceed.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 0; }
        .wrapper { max-width: 480px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 32px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: -0.5px; }
        .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
        .body { padding: 32px; }
        .body p { color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 24px; }
        .otp-box { background: #0f172a; border: 1px solid rgba(59,130,246,0.4); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
        .otp-code { font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #60a5fa; font-family: monospace; }
        .otp-timer { color: #64748b; font-size: 13px; margin-top: 10px; }
        .footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 20px 32px; }
        .footer p { color: #475569; font-size: 12px; margin: 0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>📹 Meetix</h1>
          <p>${title}</p>
        </div>
        <div class="body">
          <p>${desc}</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="otp-timer">⏱ This OTP expires in <strong>1 minute</strong></div>
          </div>
          <p style="font-size:13px; color:#64748b;">If you didn't request this, you can safely ignore this email. Do not share this OTP with anyone.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Meetix · Real-time video conferencing</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info({ to, type }, '[MAILER] OTP email sent');
  } catch (err) {
    logger.error({ err, to, type }, '[MAILER] Failed to send OTP email');
    throw new Error('Failed to send email. Please try again.');
  }
};
