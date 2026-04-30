import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;
  private from: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');

    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('RESEND_FROM_EMAIL', 'SnapFit <onboarding@resend.dev>');
  }

  private getEmailHtml(title: string, content: string, otp?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #228B22, #32CD32); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">SnapFit</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Workout Companion</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
          ${content}
          ${otp ? `
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #228B22; color: white; padding: 20px; border-radius: 8px;
                          font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
                ${otp}
              </div>
            </div>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Enter this code in the app. This code will expire in 10 minutes.
            </p>
          ` : ''}
        </div>
        <div style="background: #333; padding: 20px; text-align: center;">
          <p style="color: #999; margin: 0; font-size: 12px;">© 2024 SnapFit. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const { data, error } = await this.resend.emails.send({ from: this.from, to, subject, html });
    if (error) throw new Error(error.message);
    console.log(`✅ Email sent to ${to} [id: ${data?.id}]`);
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    const html = this.getEmailHtml(
      'Welcome to SnapFit!',
      `<p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
        Thank you for signing up! Verify your email address using the OTP code below.
      </p>`,
      otp,
    );
    await this.send(email, 'Verify Your SnapFit Account', html);
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    const html = this.getEmailHtml(
      'Password Reset Request',
      `<p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
        We received a request to reset your password. Use the OTP code below:
      </p>`,
      otp,
    );
    await this.send(email, 'Reset Your SnapFit Password', html);
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const html = this.getEmailHtml(
      `Welcome ${firstName}!`,
      `<p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
        Your email has been verified and you're ready to start your personalized fitness journey with SnapFit.
      </p>
      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #228B22;">
        <h3 style="color: #228B22; margin-top: 0;">What's Next?</h3>
        <ul style="color: #666; line-height: 1.8;">
          <li>Complete your profile setup</li>
          <li>Upload your body photos for AI analysis</li>
          <li>Add your available equipment</li>
          <li>Get your personalized 5-day workout plan</li>
        </ul>
      </div>`,
    );
    await this.send(email, "Welcome to SnapFit - Let's Start Your Fitness Journey!", html);
  }
}
