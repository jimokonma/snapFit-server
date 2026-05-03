import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private from: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('⚠️  RESEND_API_KEY is not set — email sending will be disabled');
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }
    this.from = this.configService.get<string>('RESEND_FROM_EMAIL', 'SnapFit <onboarding@resend.dev>');
  }

  private getEmailHtml(title: string, content: string, otp?: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D1117; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0D1117; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #EF4444 0%, #F59E0B 100%); border-radius: 16px 16px 0 0; padding: 36px 40px; text-align: center;">
                    <div style="display: inline-block; background: rgba(0,0,0,0.15); border-radius: 12px; padding: 10px 20px; margin-bottom: 12px;">
                      <span style="color: white; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">SNAP</span><span style="color: rgba(255,255,255,0.75); font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">FIT</span>
                    </div>
                    <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; font-weight: 500;">Your AI-Powered Workout Companion</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background-color: #111827; padding: 36px 40px;">
                    <h2 style="color: #F9FAFB; margin: 0 0 16px 0; font-size: 22px; font-weight: 700;">${title}</h2>
                    ${content}
                    ${otp ? `
                    <div style="text-align: center; margin: 32px 0 24px;">
                      <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Verification Code</p>
                      <div style="display: inline-block; background: linear-gradient(135deg, #EF4444, #F59E0B); border-radius: 12px; padding: 3px;">
                        <div style="background: #1F2937; border-radius: 10px; padding: 18px 36px;">
                          <span style="background: linear-gradient(135deg, #EF4444, #F59E0B); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-size: 36px; font-weight: 800; letter-spacing: 10px; display: inline-block; color: #EF4444;">${otp}</span>
                        </div>
                      </div>
                    </div>
                    <div style="background: #1F2937; border-radius: 10px; padding: 14px 20px; margin-bottom: 24px; border-left: 3px solid #F59E0B;">
                      <p style="color: #9CA3AF; line-height: 1.6; margin: 0; font-size: 14px;">
                        &#x23F0; This code expires in <strong style="color: #F9FAFB;">10 minutes</strong>. Enter it in the app to continue.
                      </p>
                    </div>
                    ` : ''}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #0D1117; border-radius: 0 0 16px 16px; padding: 20px 40px; text-align: center; border-top: 1px solid #1F2937;">
                    <p style="color: #4B5563; margin: 0 0 6px; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                    <p style="color: #374151; margin: 0; font-size: 11px;">&copy; 2026 SnapFit. All rights reserved.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      console.warn(`⚠️  Email not sent to ${to} (RESEND_API_KEY not configured)`);
      return;
    }
    const { data, error } = await this.resend.emails.send({ from: this.from, to, subject, html });
    if (error) throw new Error(error.message);
    console.log(`✅ Email sent to ${to} [id: ${data?.id}]`);
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    const html = this.getEmailHtml(
      'Verify Your Email',
      `<p style="color: #9CA3AF; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
        Thanks for signing up! Enter the code below to verify your email address and activate your account.
      </p>`,
      otp,
    );
    await this.send(email, 'Verify Your SnapFit Account', html);
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const html = this.getEmailHtml(
      'Reset Your Password',
      `<p style="color: #9CA3AF; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
        We received a request to reset your password. Use the code below to proceed. If you didn't request this, ignore this email.
      </p>`,
      otp,
    );
    await this.send(email, 'Reset Your SnapFit Password', html);
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const html = this.getEmailHtml(
      `You're in, ${firstName}! &#x1F525;`,
      `<p style="color: #9CA3AF; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">
        Your email is verified and your SnapFit account is ready. Let's build something extraordinary.
      </p>
      <div style="background: #1F2937; border-radius: 12px; padding: 24px; margin: 0 0 24px; border-left: 4px solid #EF4444;">
        <h3 style="color: #F9FAFB; margin: 0 0 16px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Next Steps</h3>
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #374151;">
              <span style="color: #EF4444; font-size: 14px; font-weight: 700; margin-right: 10px;">01</span>
              <span style="color: #D1D5DB; font-size: 14px;">Complete your profile setup</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #374151;">
              <span style="color: #EF4444; font-size: 14px; font-weight: 700; margin-right: 10px;">02</span>
              <span style="color: #D1D5DB; font-size: 14px;">Upload body photos for AI analysis</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #374151;">
              <span style="color: #EF4444; font-size: 14px; font-weight: 700; margin-right: 10px;">03</span>
              <span style="color: #D1D5DB; font-size: 14px;">Add your available equipment</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: #F59E0B; font-size: 14px; font-weight: 700; margin-right: 10px;">04</span>
              <span style="color: #D1D5DB; font-size: 14px;">Get your personalized AI workout plan</span>
            </td>
          </tr>
        </table>
      </div>`,
    );
    await this.send(email, "Welcome to SnapFit - Let's Start Your Fitness Journey!", html);
  }
}
