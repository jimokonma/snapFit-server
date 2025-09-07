import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('GMAIL_USER'),
        pass: this.configService.get<string>('GMAIL_APP_PASSWORD'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL')}/verify-email?token=${token}`;
    
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
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #228B22; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              If the button doesn't work, you can also copy and paste this link into your browser:
            </p>
            <p style="color: #228B22; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
              ${verificationUrl}
            </p>
            
            <p style="color: #666; line-height: 1.6; margin-top: 30px; font-size: 14px;">
              This verification link will expire in 24 hours. If you didn't create an account with SnapFit, 
              please ignore this email.
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

    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(email: string, otp: string): Promise<void> {
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

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
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

    await this.transporter.sendMail(mailOptions);
  }
}
