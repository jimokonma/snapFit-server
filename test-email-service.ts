import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { EmailService } from './src/common/services/email.service';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function testEmailService() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing Email Service on Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const testEmail = process.env.TEST_EMAIL || gmailUser || 'test@example.com';

  console.log('📋 Configuration Check:');
  console.log(`   RESEND_API_KEY: ${resendApiKey ? 'SET (' + resendApiKey.substring(0, 8) + '***)' : '❌ NOT SET'}`);
  console.log(`   RESEND_FROM_EMAIL: ${resendFromEmail || '❌ NOT SET (will use default)'}`);
  console.log(`   GMAIL_USER: ${gmailUser ? gmailUser.substring(0, 3) + '***' : '❌ NOT SET'}`);
  console.log(`   GMAIL_APP_PASSWORD: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : '❌ NOT SET'}`);
  console.log(`   TEST_EMAIL: ${testEmail}\n`);

  if (!resendApiKey && (!gmailUser || !gmailPassword)) {
    console.error('❌ No email provider configured!');
    console.error('   Please set either:');
    console.error('   - RESEND_API_KEY (recommended for cloud platforms)');
    console.error('   - OR GMAIL_USER and GMAIL_APP_PASSWORD');
    process.exit(1);
  }

  if (!testEmail || testEmail === 'test@example.com') {
    console.error('❌ No test email address provided!');
    console.error('   Set TEST_EMAIL environment variable');
    process.exit(1);
  }

  try {
    // Create NestJS application context to get EmailService
    console.log('🔧 Initializing NestJS application...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const emailService = app.get(EmailService);

    console.log('✅ Email service initialized\n');

    // Test 1: Verification Email
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 TEST 1: Verification Email (Signup Flow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const verificationOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔑 Generated Verification OTP: ${verificationOTP}`);
    console.log(`📧 Sending to: ${testEmail}\n`);

    try {
      await emailService.sendVerificationEmail(testEmail, verificationOTP);
      console.log('✅ Verification email sent successfully!\n');
    } catch (error: any) {
      console.error('❌ Verification email failed!');
      console.error(`📧 Error: ${error.message || error}\n`);
    }

    // Wait a bit before sending second email
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Password Reset Email
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 TEST 2: Password Reset Email (Forgot Password Flow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔑 Generated Password Reset OTP: ${resetOTP}`);
    console.log(`📧 Sending to: ${testEmail}\n`);

    try {
      await emailService.sendPasswordResetEmail(testEmail, resetOTP);
      console.log('✅ Password reset email sent successfully!\n');
    } catch (error: any) {
      console.error('❌ Password reset email failed!');
      console.error(`📧 Error: ${error.message || error}\n`);
    }

    // Wait a bit before sending third email
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Welcome Email
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👋 TEST 3: Welcome Email (After Email Verification)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const firstName = 'Test';
    console.log(`👤 First Name: ${firstName}`);
    console.log(`📧 Sending to: ${testEmail}\n`);

    try {
      await emailService.sendWelcomeEmail(testEmail, firstName);
      console.log('✅ Welcome email sent successfully!\n');
    } catch (error: any) {
      console.error('❌ Welcome email failed!');
      console.error(`📧 Error: ${error.message || error}\n`);
    }

    // Close the application context
    await app.close();

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Email Service Tests Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Summary:');
    console.log(`   📧 Test Email: ${testEmail}`);
    console.log(`   🔑 Verification OTP: ${verificationOTP}`);
    console.log(`   🔑 Password Reset OTP: ${resetOTP}`);
    console.log(`   👤 Welcome Email: Sent to ${firstName}\n`);
    console.log('💡 Check your inbox for all three test emails.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed with error:');
    console.error(`📧 Error type: ${error.name || typeof error}`);
    console.error(`📧 Error message: ${error.message || error}`);
    
    if (error.stack) {
      console.error(`📧 Stack trace:\n${error.stack}`);
    }

    console.error('\n💡 Troubleshooting:');
    if (resendApiKey) {
      console.error('   - Verify RESEND_API_KEY is correct');
      console.error('   - Check Resend dashboard for API status');
      console.error('   - Ensure RESEND_FROM_EMAIL is verified in Resend');
    } else {
      console.error('   - Verify GMAIL_USER and GMAIL_APP_PASSWORD are correct');
      console.error('   - Ensure 2-Step Verification is enabled on Gmail');
      console.error('   - Generate a new App Password from Google Account settings');
      console.error('   - Consider using Resend API (RESEND_API_KEY) for cloud platforms');
    }

    process.exit(1);
  }
}

// Run the test
testEmailService().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

