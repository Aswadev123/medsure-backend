import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface OtpEntry {
  code: string;
  expiresAt: number;
  verified?: boolean;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private store: Map<string, OtpEntry> = new Map();

  // Generate 6-digit OTP
  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(email: string) {
    const code = this.generateCode();
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = Date.now() + ttlMs;

    this.store.set(email, { code, expiresAt, verified: false });

    // Attempt to send email via SMTP if configured, otherwise log the code
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      try {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          } : undefined,
        });

        const info = await transport.sendMail({
          from: process.env.SMTP_FROM || 'no-reply@medsure.local',
          to: email,
          subject: 'Your MedSure verification code',
          text: `Your verification code is: ${code}. It will expire in 5 minutes.`,
        });

        this.logger.log(`Sent OTP to ${email}: ${info.messageId}`);
        return { sent: true };
      } catch (err: any) {
        this.logger.warn(`Failed to send OTP email to ${email}: ${err?.message || err}`);
        // continue and return sent=false but store OTP for testing
        return { sent: false };
      }
    }

    // No SMTP configured — log the OTP for development
    this.logger.log(`OTP for ${email}: ${code} (expires in 5 minutes)`);
    return { sent: false };
  }

  verifyOtp(email: string, code: string) {
    const entry = this.store.get(email);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(email);
      return false;
    }
    if (entry.code === String(code)) {
      entry.verified = true;
      // keep verification for short time
      entry.expiresAt = Date.now() + 5 * 60 * 1000;
      this.store.set(email, entry);
      return true;
    }
    return false;
  }

  isVerified(email: string) {
    const entry = this.store.get(email);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(email);
      return false;
    }
    return !!entry.verified;
  }

  clear(email: string) {
    this.store.delete(email);
  }
}
