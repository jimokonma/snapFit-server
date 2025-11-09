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

    // Debug logging for environment detection
    console.log('🔍 Email Service Configuration Check:');
    console.log(`   RESEND_API_KEY: ${resendApiKey ? 'SET (' + resendApiKey.substring(0, 8) + '***)' : '❌ NOT SET'}`);
    console.log(`   RESEND_FROM_EMAIL: ${this.configService.get<string>('RESEND_FROM_EMAIL') || 'NOT SET (will use default)'}`);
    console.log(`   GMAIL_USER: ${gmailUser ? gmailUser.substring(0, 3) + '***' : '❌ NOT SET'}`);
    console.log(`   GMAIL_APP_PASSWORD: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : '❌ NOT SET'}`);

    // Try Resend API first, but fall back to Gmail if it fails
    let resendInitialized = false;
    if (resendApiKey) {
      try {
        console.log(`📧 Attempting to initialize Resend API...`);
        this.resend = new Resend(resendApiKey);
        // Test the API key by trying to verify it (we'll catch errors in send methods)
        this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
        this.emailProvider = 'resend';
        resendInitialized = true;
        console.log(`✅ Resend API initialized (will verify on first send)`);
        console.log(`📧 From email: ${this.fromEmail}`);
      } catch (error: any) {
        console.warn('⚠️  Failed to initialize Resend:', error.message);
        console.warn('⚠️  Falling back to Gmail SMTP...');
        resendInitialized = false;
      }
    }

    // Initialize Gmail SMTP (use as primary if Resend not initialized, or as fallback)
    if (gmailUser && gmailPassword) {
      try {
        if (!resendInitialized) {
          console.log(`📧 Initializing email service with Gmail SMTP (primary)...`);
        } else {
          console.log(`📧 Initializing Gmail SMTP as fallback...`);
        }
        console.log(`📧 Gmail User: ${gmailUser ? gmailUser.substring(0, 3) + '***' : 'NOT SET'}`);
        console.log(`📧 Gmail Password: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : 'NOT SET'}`);
        
        // Try multiple Gmail SMTP configurations for better cloud platform compatibility
        const smtpConfigs = [
          // Configuration 1: Port 587 with STARTTLS (most common)
          {
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
            connectionTimeout: 60000, // Increased to 60 seconds
            greetingTimeout: 60000,
            socketTimeout: 60000,
            requireTLS: true,
            debug: false,
            logger: false,
          },
          // Configuration 2: Port 465 with SSL (alternative)
          {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: gmailUser,
              pass: gmailPassword,
            },
            tls: {
              rejectUnauthorized: false,
            },
            connectionTimeout: 60000,
            greetingTimeout: 60000,
            socketTimeout: 60000,
            debug: false,
            logger: false,
          },
        ];

        // Try first configuration
        this.transporter = nodemailer.createTransport(smtpConfigs[0]);
        this.fromEmail = gmailUser;
        
        // If Resend wasn't initialized, use Gmail as primary
        if (!resendInitialized) {
          this.emailProvider = 'gmail';
        }
        
        console.log('✅ Gmail SMTP transporter created');
        console.log(`📧 Using port ${smtpConfigs[0].port} with ${smtpConfigs[0].secure ? 'SSL' : 'STARTTLS'}`);
        
        // Verify transporter connection asynchronously (don't block)
        this.transporter.verify().then(() => {
          console.log('✅ Gmail SMTP connection verified successfully');
        }).catch((error: any) => {
          console.warn('⚠️  Gmail SMTP verification failed (will retry on send):', error.message);
          console.warn('⚠️  This is normal on cloud platforms - connection will be established on first send');
        });
      } catch (error: any) {
        console.error('❌ Failed to initialize Gmail SMTP:', error.message);
        if (!resendInitialized) {
          this.emailProvider = 'none';
        }
      }
    }
    
    // Final check
    if (this.emailProvider === 'none') {
      console.warn('⚠️  EMAIL SERVICE WARNING: No email provider configured!');
      console.warn('⚠️  Configure GMAIL_USER and GMAIL_APP_PASSWORD');
      console.warn('⚠️  Email notifications will not be sent. OTPs will be logged to console instead.');
    } else if (resendInitialized && this.transporter) {
      console.log('✅ Email service configured with Resend (primary) and Gmail SMTP (fallback)');
    } else if (this.emailProvider === 'gmail') {
      console.log('✅ Email service configured with Gmail SMTP');
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
        console.log(`📧 From: ${this.fromEmail}`);
        console.log(`📧 To: ${email}`);
        
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        
        // Log full response for debugging
        console.log(`📨 Resend API Response:`, JSON.stringify(result, null, 2));
        
        // Check if there's an error in the response
        if (result.error) {
          console.error('❌ Resend API returned an error:');
          console.error(`📧 Error: ${JSON.stringify(result.error, null, 2)}`);
          
          // Check for domain verification error (403)
          if (result.error.statusCode === 403 && result.error.message?.includes('domain is not verified')) {
            console.error('❌ Domain verification error!');
            console.error(`📧 Current from email: ${this.fromEmail}`);
            console.error(`📧 You must use a verified domain email address (e.g., noreply@jim-okonma.xyz)`);
            console.error(`📧 Set RESEND_FROM_EMAIL=noreply@jim-okonma.xyz in Render.com environment variables`);
            console.error(`📧 Verification OTP for ${email}: ${otp} (use this to verify manually)`);
            return;
          }
          
          // If Resend fails (invalid API key, etc.), fall back to Gmail SMTP
          if (this.transporter && (result.error.statusCode === 401 || (result.error.name === 'validation_error' && result.error.statusCode !== 403))) {
            console.warn('⚠️  Resend API key is invalid. Falling back to Gmail SMTP...');
            // Switch to Gmail provider
            this.emailProvider = 'gmail';
            // Retry with Gmail SMTP
            return this.sendVerificationEmail(email, otp);
          }
          
          console.error(`📧 Verification OTP for ${email}: ${otp} (use this to verify manually)`);
          return;
        }
        
        // Check if email ID is present (indicates success)
        if (result.data?.id) {
          console.log(`✅ Verification email sent successfully to ${email}`);
          console.log(`📨 Resend email ID: ${result.data.id}`);
        } else {
          console.warn('⚠️  Resend API call succeeded but no email ID returned');
          console.warn(`📧 Response: ${JSON.stringify(result, null, 2)}`);
          console.warn(`📧 Verification OTP for ${email}: ${otp} (use this to verify manually)`);
        }
      } catch (error: any) {
        console.error('❌ Failed to send verification email via Resend');
        console.error(`📧 Error type: ${error.name || typeof error}`);
        console.error(`📧 Error message: ${error.message || error}`);
        
        // If Resend fails, fall back to Gmail SMTP
        if (this.transporter && (error.statusCode === 401 || error.message?.includes('API key'))) {
          console.warn('⚠️  Resend API failed. Falling back to Gmail SMTP...');
          this.emailProvider = 'gmail';
          return this.sendVerificationEmail(email, otp);
        }
        
        if (error.response) {
          console.error(`📧 Error response: ${JSON.stringify(error.response, null, 2)}`);
        }
        if (error.statusCode) {
          console.error(`📧 Status code: ${error.statusCode}`);
        }
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
        console.log(`📧 From: ${this.fromEmail}`);
        console.log(`📧 To: ${email}`);
        
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        
        // Log full response for debugging
        console.log(`📨 Resend API Response:`, JSON.stringify(result, null, 2));
        
        // Check if there's an error in the response
        if (result.error) {
          console.error('❌ Resend API returned an error:');
          console.error(`📧 Error: ${JSON.stringify(result.error, null, 2)}`);
          
          // Check for domain verification error (403)
          if (result.error.statusCode === 403 && result.error.message?.includes('domain is not verified')) {
            console.error('❌ Domain verification error!');
            console.error(`📧 Current from email: ${this.fromEmail}`);
            console.error(`📧 You must use a verified domain email address (e.g., noreply@jim-okonma.xyz)`);
            console.error(`📧 Set RESEND_FROM_EMAIL=noreply@jim-okonma.xyz in Render.com environment variables`);
            console.error(`📧 Password reset OTP for ${email}: ${otp} (use this to reset manually)`);
            return;
          }
          
          // If Resend fails (invalid API key, etc.), fall back to Gmail SMTP
          if (this.transporter && (result.error.statusCode === 401 || (result.error.name === 'validation_error' && result.error.statusCode !== 403))) {
            console.warn('⚠️  Resend API key is invalid. Falling back to Gmail SMTP...');
            // Switch to Gmail provider
            this.emailProvider = 'gmail';
            // Retry with Gmail SMTP
            return this.sendPasswordResetEmail(email, otp);
          }
          
          console.error(`📧 Password reset OTP for ${email}: ${otp} (use this to reset manually)`);
          return;
        }
        
        // Check if email ID is present (indicates success)
        if (result.data?.id) {
          console.log(`✅ Password reset email sent successfully to ${email}`);
          console.log(`📨 Resend email ID: ${result.data.id}`);
        } else {
          console.warn('⚠️  Resend API call succeeded but no email ID returned');
          console.warn(`📧 Response: ${JSON.stringify(result, null, 2)}`);
          console.warn(`📧 Password reset OTP for ${email}: ${otp} (use this to reset manually)`);
        }
      } catch (error: any) {
        console.error('❌ Failed to send password reset email via Resend');
        console.error(`📧 Error type: ${error.name || typeof error}`);
        console.error(`📧 Error message: ${error.message || error}`);
        if (error.response) {
          console.error(`📧 Error response: ${JSON.stringify(error.response, null, 2)}`);
        }
        if (error.statusCode) {
          console.error(`📧 Status code: ${error.statusCode}`);
        }
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
        console.log(`📧 From: ${this.fromEmail}`);
        console.log(`📧 To: ${email}`);
        
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to: email,
          subject,
          html,
        });
        
        // Log full response for debugging
        console.log(`📨 Resend API Response:`, JSON.stringify(result, null, 2));
        
        // Check if there's an error in the response
        if (result.error) {
          console.error('❌ Resend API returned an error:');
          console.error(`📧 Error: ${JSON.stringify(result.error, null, 2)}`);
          
          // Check for domain verification error (403)
          if (result.error.statusCode === 403 && result.error.message?.includes('domain is not verified')) {
            console.error('❌ Domain verification error!');
            console.error(`📧 Current from email: ${this.fromEmail}`);
            console.error(`📧 You must use a verified domain email address (e.g., noreply@jim-okonma.xyz)`);
            console.error(`📧 Set RESEND_FROM_EMAIL=noreply@jim-okonma.xyz in Render.com environment variables`);
            return;
          }
          
          // If Resend fails (invalid API key, etc.), fall back to Gmail SMTP
          if (this.transporter && (result.error.statusCode === 401 || (result.error.name === 'validation_error' && result.error.statusCode !== 403))) {
            console.warn('⚠️  Resend API key is invalid. Falling back to Gmail SMTP...');
            // Switch to Gmail provider
            this.emailProvider = 'gmail';
            // Retry with Gmail SMTP
            return this.sendWelcomeEmail(email, firstName);
          }
          
          return;
        }
        
        // Check if email ID is present (indicates success)
        if (result.data?.id) {
          console.log(`✅ Welcome email sent successfully to ${email}`);
          console.log(`📨 Resend email ID: ${result.data.id}`);
        } else {
          console.warn('⚠️  Resend API call succeeded but no email ID returned');
          console.warn(`📧 Response: ${JSON.stringify(result, null, 2)}`);
        }
      } catch (error: any) {
        console.error('❌ Failed to send welcome email via Resend');
        console.error(`📧 Error type: ${error.name || typeof error}`);
        console.error(`📧 Error message: ${error.message || error}`);
        if (error.response) {
          console.error(`📧 Error response: ${JSON.stringify(error.response, null, 2)}`);
        }
        if (error.statusCode) {
          console.error(`📧 Status code: ${error.statusCode}`);
        }
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
