import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const emailFrom = process.env.EMAIL_FROM || `SecureChat <no-reply@securechat.local>`;

if (!smtpHost || !smtpUser || !smtpPass) {
  console.warn(
    "Missing SMTP configuration. OTP email delivery requires SMTP_HOST, SMTP_USER, and SMTP_PASS."
  );
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: process.env.SMTP_SECURE === "true",
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

export const sendOtpEmail = async (email, fullName, otp) => {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      "SMTP configuration is not complete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS to send OTP emails."
    );
  }

  return transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: "SecureChat registration OTP",
    text: `Hello ${fullName},\n\nYour SecureChat registration code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>SecureChat OTP Verification</h2>
        <p>Hello ${fullName},</p>
        <p>Your registration code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this code, ignore this message.</p>
      </div>
    `,
  });
};
