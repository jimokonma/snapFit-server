import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;
  private emailProvider: 'resend' | 'gmail' | 'none' = 'none';
  private fromEmail: string = '';

  constructor(private configService: ConfigService) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    // Prefer Resend API (works better on cloud platforms like Render.com)
    if (resendApiKey) {
      try {
        console.log(`📧 Initializing email service with Resend API...`);
        this.resend = new Resend(resendApiKey);
        this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
        this.emailProvider = 'resend';
        console.log(`✅ Email service initialized with Resend API`);
        console.log(`📧 From email: ${this.fromEmail}`);
        return;
      } catch (error: any) {
        console.error('❌ Failed to initialize Resend:', error.message);
      }
    }

    // Fallback to Gmail SMTP if Resend is not configured
    if (gmailUser && gmailPassword) {
      try {
        console.log(`📧 Initializing email service with Gmail SMTP...`);
        console.log(`📧 Gmail User: ${gmailUser ? gmailUser.substring(0, 3) + '***' : 'NOT SET'}`);
        console.log(`📧 Gmail Password: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : 'NOT SET'}`);
        
        this.transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: gmailUser,
            pass: gmailPassword,
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 30000,
          requireTLS: true,
          debug: false,
          logger: false,
        });
        
        this.fromEmail = gmailUser;
        this.emailProvider = 'gmail';
        console.log('✅ Email service initialized with Gmail SMTP');
        
        // Verify transporter connection asynchronously
        this.transporter.verify().then(() => {
          console.log('✅ Gmail SMTP connection verified');
        }).catch((error: any) => {
          console.error('⚠️  Gmail SMTP verification failed:', error.message);
          console.error('⚠️  Consider using Resend API (RESEND_API_KEY) for better cloud platform compatibility');
        });
      } catch (error: any) {
        console.error('❌ Failed to initialize Gmail SMTP:', error.message);
        this.emailProvider = 'none';
      }
    } else {
      console.warn('⚠️  EMAIL SERVICE WARNING: No email provider configured!');
      console.warn('⚠️  Configure RESEND_API_KEY (recommended) or GMAIL_USER/GMAIL_APP_PASSWORD');
      console.warn('⚠️  Email notifications will not be sent. OTPs will be logged to console instead.');
      this.emailProvider = 'none';
    }
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
          <p style="color: #999; margin: 0; font-size: 12px;">
            © 2024 SnapFit. All rights reserved.
          </p>
        </div>
      </div>
    `;
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    console.log(`📧 Attempting to send verification email to: ${email}`);
    console.log(`🔑 Verification OTP: ${otp}`);
    
    if (this.emailProvider === 'none') {
      console.error('❌ Cannot send verification email: Email service not configured');
      console.error(`📧 Verification OTP for ${email}: ${otp}`);
      console.error('⚠️  Configure RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD');
      console.error('⚠️  For now, use the OTP above to manually verify your email');
      return;
    }

    const subject = 'Verify Your SnapFit Account';
    const html = this.getEmailHtml(
      'Welcome to SnapFit!',
      `
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Thank you for signing up! To complete your registration and start your fitness journey, 
          please verify your email address using the OTP code below.
        </p>
      `,
      otp
    );

    if (this.emailProvider === 'resend' && this.resend) {
      try {
        console.log(`📤 Sending email via Resend API...`);
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        console.log(`✅ Verification email sent successfully to ${email}`);
        console.log(`📨 Resend email ID: ${result.data?.id}`);
      } catch (error: any) {
        console.error('❌ Failed to send verification email via Resend');
        console.error(`📧 Error: ${error.message || error}`);
        console.error(`📧 Verification OTP for ${email}: ${otp} (use this to verify manually)`);
      }
    } else if (this.emailProvider === 'gmail' && this.transporter) {
      try {
        console.log(`📤 Sending email via Gmail SMTP...`);
        const mailOptions = {
          from: this.fromEmail,
          to: email,
          subject,
          html,
        };
        
        // Retry logic for Gmail SMTP
        let lastError: any;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await Promise.race([
              this.transporter.sendMail(mailOptions),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Email send timeout')), 45000)
              )
            ]);
            console.log(`✅ Verification email sent successfully to ${email} (attempt ${attempt})`);
            return;
          } catch (attemptError: any) {
            lastError = attemptError;
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(`⚠️  Email send attempt ${attempt} failed, retrying in ${delay}ms...`);
              console.warn(`   Error: ${attemptError.message || attemptError}`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      } catch (error: any) {
        console.error('❌ Failed to send verification email via Gmail SMTP');
        console.error(`📧 Error type: ${error.name || typeof error}`);
        console.error(`📧 Error message: ${error.message || error}`);
        console.error(`📧 Verification OTP for ${email}: ${otp} (use this to verify manually)`);
        if (error.code) {
          console.error(`📧 Error code: ${error.code}`);
        }
        if (error.command) {
          console.error(`📧 Failed command: ${error.command}`);
        }
      }
    }
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    console.log(`📧 Attempting to send password reset email to: ${email}`);
    console.log(`🔑 Password reset OTP: ${otp}`);
    
    if (this.emailProvider === 'none') {
      console.error('❌ Cannot send password reset email: Email service not configured');
      console.error(`📧 Password reset OTP for ${email}: ${otp}`);
      console.error('⚠️  Configure RESEND_API_KEY or GMAIL_USER/GMAIL_APP_PASSWORD');
      console.error('⚠️  For now, use the OTP above to manually reset your password');
      return;
    }

    const subject = 'Reset Your SnapFit Password';
    const html = this.getEmailHtml(
      'Password Reset Request',
      `
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          We received a request to reset your password. Use the OTP code below to reset your password:
        </p>
      `,
      otp
    );

    if (this.emailProvider === 'resend' && this.resend) {
      try {
        console.log(`📤 Sending password reset email via Resend API...`);
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        console.log(`✅ Password reset email sent successfully to ${email}`);
        console.log(`📨 Resend email ID: ${result.data?.id}`);
      } catch (error: any) {
        console.error('❌ Failed to send password reset email via Resend');
        console.error(`📧 Error: ${error.message || error}`);
        console.error(`📧 Password reset OTP for ${email}: ${otp} (use this to reset manually)`);
      }
    } else if (this.emailProvider === 'gmail' && this.transporter) {
      try {
        console.log(`📤 Sending password reset email via Gmail SMTP...`);
        const mailOptions = {
          from: this.fromEmail,
          to: email,
          subject,
          html,
        };
        
        let lastError: any;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await Promise.race([
              this.transporter.sendMail(mailOptions),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Email send timeout')), 45000)
              )
            ]);
            console.log(`✅ Password reset email sent successfully to ${email} (attempt ${attempt})`);
            return;
          } catch (attemptError: any) {
            lastError = attemptError;
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(`⚠️  Email send attempt ${attempt} failed, retrying in ${delay}ms...`);
              console.warn(`   Error: ${attemptError.message || attemptError}`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      } catch (error: any) {
        console.error('❌ Failed to send password reset email via Gmail SMTP');
        console.error(`📧 Error: ${error.message || error}`);
        console.error(`📧 Password reset OTP for ${email}: ${otp} (use this to reset manually)`);
      }
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (this.emailProvider === 'none') {
      console.error('❌ Cannot send welcome email: Email service not configured');
      console.error(`📧 Welcome email would be sent to ${email} (${firstName})`);
      return;
    }

    const subject = 'Welcome to SnapFit - Let\'s Start Your Fitness Journey!';
    const html = this.getEmailHtml(
      `Welcome ${firstName}!`,
      `
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Congratulations! Your email has been verified and you're now ready to start your personalized fitness journey with SnapFit.
        </p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #228B22;">
          <h3 style="color: #228B22; margin-top: 0;">What's Next?</h3>
          <ul style="color: #666; line-height: 1.8;">
            <li>Complete your profile setup</li>
            <li>Upload your body photos for AI analysis</li>
            <li>Add your available equipment</li>
            <li>Get your personalized 5-day workout plan</li>
          </ul>
        </div>
        
        <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
          Our AI will analyze your photos and equipment to create a workout plan that's perfectly tailored to your goals and fitness level.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #228B22; font-weight: bold; font-size: 18px;">
            Ready to transform your fitness journey? Let's get started! 💪
          </p>
        </div>
      `
    );

    if (this.emailProvider === 'resend' && this.resend) {
      try {
        console.log(`📤 Sending welcome email via Resend API...`);
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        console.log(`✅ Welcome email sent successfully to ${email}`);
        console.log(`📨 Resend email ID: ${result.data?.id}`);
      } catch (error: any) {
        console.error('❌ Failed to send welcome email via Resend:', error.message || error);
      }
    } else if (this.emailProvider === 'gmail' && this.transporter) {
      try {
        console.log(`📤 Sending welcome email via Gmail SMTP...`);
        const mailOptions = {
          from: this.fromEmail,
          to: email,
          subject,
          html,
        };
        
        let lastError: any;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await Promise.race([
              this.transporter.sendMail(mailOptions),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Email send timeout')), 45000)
              )
            ]);
            console.log(`✅ Welcome email sent successfully to ${email} (attempt ${attempt})`);
            return;
          } catch (attemptError: any) {
            lastError = attemptError;
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              console.warn(`⚠️  Email send attempt ${attempt} failed, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        throw lastError;
      } catch (error: any) {
        console.error('❌ Failed to send welcome email via Gmail SMTP:', error.message || error);
      }
    }
  }
}
