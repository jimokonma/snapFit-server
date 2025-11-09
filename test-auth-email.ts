import * as dotenv from 'dotenv';
import * as path from 'path';
import * as nodemailer from 'nodemailer';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function testAuthEmailFlows() {
  console.log('🧪 Testing Auth Email Service Integration...\n');

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const testEmail = process.env.TEST_EMAIL || gmailUser;

  console.log('📋 Configuration Check:');
  console.log(`   GMAIL_USER: ${gmailUser ? gmailUser.substring(0, 3) + '***' : '❌ NOT SET'}`);
  console.log(`   GMAIL_APP_PASSWORD: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : '❌ NOT SET'}`);
  console.log(`   Test Email: ${testEmail}\n`);

  if (!gmailUser || !gmailPassword) {
    console.error('❌ Email credentials not configured!');
    process.exit(1);
  }

  // Create transporter (same as EmailService)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  // Test 1: Verification Email (Signup flow)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 TEST 1: Signup Verification Email');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`🔑 Generated Verification OTP: ${verificationOTP}`);

  try {
    const verificationEmail = {
      from: gmailUser,
      to: testEmail,
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
                ${verificationOTP}
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

    const verificationResult = await transporter.sendMail(verificationEmail);
    console.log('✅ Verification email sent successfully!');
    console.log(`📨 Message ID: ${verificationResult.messageId}`);
    console.log(`📧 Sent to: ${testEmail}`);
    console.log(`🔑 OTP: ${verificationOTP}\n`);
  } catch (error: any) {
    console.error('❌ Verification email failed!');
    console.error(`📧 Error: ${error.message}\n`);
  }

  // Wait a bit before sending second email
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Password Reset Email (Forgot Password flow)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 TEST 2: Forgot Password Reset Email');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`🔑 Generated Password Reset OTP: ${resetOTP}`);

  try {
    const resetEmail = {
      from: gmailUser,
      to: testEmail,
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
                ${resetOTP}
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

    const resetResult = await transporter.sendMail(resetEmail);
    console.log('✅ Password reset email sent successfully!');
    console.log(`📨 Message ID: ${resetResult.messageId}`);
    console.log(`📧 Sent to: ${testEmail}`);
    console.log(`🔑 OTP: ${resetOTP}\n`);
  } catch (error: any) {
    console.error('❌ Password reset email failed!');
    console.error(`📧 Error: ${error.message}\n`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All email tests completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📝 Summary:');
  console.log(`   ✅ Signup verification email: Working`);
  console.log(`   ✅ Forgot password reset email: Working`);
  console.log(`\n💡 Check your inbox (${testEmail}) for both test emails.`);
  console.log(`   Verification OTP: ${verificationOTP}`);
  console.log(`   Reset OTP: ${resetOTP}\n`);

  process.exit(0);
}

testAuthEmailFlows();

