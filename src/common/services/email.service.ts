import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private isEmailConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    // Check if email credentials are configured
    if (!gmailUser || !gmailPassword) {
      console.warn('⚠️  EMAIL SERVICE WARNING: GMAIL_USER or GMAIL_APP_PASSWORD not configured!');
      console.warn('⚠️  Email notifications will not be sent. Please configure email credentials in .env file.');
      this.isEmailConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 10000, // 10 seconds
      });
      this.isEmailConfigured = true;
      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
      this.isEmailConfigured = false;
    }
  }

  async sendVerificationEmail(email: string, otp: string): Promise<void> {
    if (!this.isEmailConfigured) {
      console.error('❌ Cannot send verification email: Email service not configured');
      console.error(`📧 Verification OTP for ${email}: ${otp}`);
      console.error('⚠️  Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('GMAIL_USER'),
      to: email,
      subject: 'Verify Your SnapFit Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #228B22, #32CD32); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SnapFit</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Workout Companion</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome to SnapFit!</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Thank you for signing up! To complete your registration and start your fitness journey, 
              please verify your email address using the OTP code below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #228B22; color: white; padding: 20px; border-radius: 8px; 
                          font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Enter this code in the app to verify your email address. This code will expire in 10 minutes.
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-top: 30px; font-size: 14px;">
              If you didn't create an account with SnapFit, please ignore this email.
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; margin: 0; font-size: 12px;">
              © 2024 SnapFit. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      const result = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email send timeout')), 15000)
        )
      ]);
      console.log(`✅ Verification email sent successfully to ${email}`);
    } catch (error: any) {
      // Log detailed error but don't throw - email sending should not block registration
      console.error('❌ Failed to send verification email:', error.message || error);
      console.error(`📧 Verification OTP for ${email}: ${otp}`);
      if (error.response) {
        console.error('Email service error response:', error.response);
      }
    }
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
    if (!this.isEmailConfigured) {
      console.error('❌ Cannot send password reset email: Email service not configured');
      console.error(`📧 Password reset OTP for ${email}: ${otp}`);
      console.error('⚠️  Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('GMAIL_USER'),
      to: email,
      subject: 'Reset Your SnapFit Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #228B22, #32CD32); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SnapFit</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Workout Companion</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              We received a request to reset your password. Use the OTP code below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #228B22; color: white; padding: 20px; border-radius: 8px; 
                          font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
                ${otp}
              </div>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Enter this code in the app to reset your password. This code will expire in 10 minutes.
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-top: 30px; font-size: 14px;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; margin: 0; font-size: 12px;">
              © 2024 SnapFit. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      const result = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email send timeout')), 15000)
        )
      ]);
      console.log(`✅ Password reset email sent successfully to ${email}`);
    } catch (error: any) {
      // Log detailed error but don't throw - email sending should not block password reset
      console.error('❌ Failed to send password reset email:', error.message || error);
      console.error(`📧 Password reset OTP for ${email}: ${otp}`);
      if (error.response) {
        console.error('Email service error response:', error.response);
      }
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (!this.isEmailConfigured) {
      console.error('❌ Cannot send welcome email: Email service not configured');
      console.error(`📧 Welcome email would be sent to ${email} (${firstName})`);
      console.error('⚠️  Please configure GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('GMAIL_USER'),
      to: email,
      subject: 'Welcome to SnapFit - Let\'s Start Your Fitness Journey!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #228B22, #32CD32); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SnapFit</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Workout Companion</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome ${firstName}!</h2>
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
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; margin: 0; font-size: 12px;">
              © 2024 SnapFit. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };

    try {
      const result = await Promise.race([
        this.transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email send timeout')), 15000)
        )
      ]);
      console.log(`✅ Welcome email sent successfully to ${email}`);
    } catch (error: any) {
      // Log detailed error but don't throw - email sending should not block email verification
      console.error('❌ Failed to send welcome email:', error.message || error);
      if (error.response) {
        console.error('Email service error response:', error.response);
      }
    }
  }
}
