import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function testEmail() {
  console.log('🧪 Testing Email Service...\n');

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const testEmail = process.env.TEST_EMAIL || gmailUser;

  console.log('📋 Configuration Check:');
  console.log(`   GMAIL_USER: ${gmailUser ? gmailUser.substring(0, 3) + '***' : '❌ NOT SET'}`);
  console.log(`   GMAIL_APP_PASSWORD: ${gmailPassword ? 'SET (' + gmailPassword.length + ' chars)' : '❌ NOT SET'}`);
  console.log(`   Test Email: ${testEmail}\n`);

  if (!gmailUser || !gmailPassword) {
    console.error('❌ Email credentials not configured!');
    console.error('   Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env file');
    process.exit(1);
  }

  if (!testEmail) {
    console.error('❌ No test email address provided!');
    console.error('   Set TEST_EMAIL in .env or use GMAIL_USER');
    process.exit(1);
  }

  try {
    console.log('📧 Creating email transporter...');
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

    console.log('🔍 Verifying email connection...');
    await transporter.verify();
    console.log('✅ Email connection verified!\n');

    const testOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`📤 Sending test email to: ${testEmail}`);
    console.log(`🔑 Test OTP: ${testOTP}\n`);

    const mailOptions = {
      from: gmailUser,
      to: testEmail,
      subject: 'SnapFit - Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #228B22, #32CD32); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SnapFit</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Email Service Test</p>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Test Email</h2>
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              This is a test email from SnapFit. If you received this, your email service is working correctly!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #228B22; color: white; padding: 20px; border-radius: 8px; 
                          font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
                ${testOTP}
              </div>
            </div>
            
            <p style="color: #666; line-height: 1.6; margin-top: 30px; font-size: 14px;">
              Test completed at: ${new Date().toLocaleString()}
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

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    console.log(`📧 Sent to: ${testEmail}`);
    console.log(`🔑 Test OTP: ${testOTP}`);
    console.log('\n✅ Email service is working correctly!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Email test failed!');
    console.error(`📧 Error type: ${error.name || typeof error}`);
    console.error(`📧 Error message: ${error.message || error}`);
    
    if (error.code) {
      console.error(`📧 Error code: ${error.code}`);
    }
    
    if (error.response) {
      console.error(`📧 Error response:`, JSON.stringify(error.response, null, 2));
    }
    
    if (error.command) {
      console.error(`📧 Failed command: ${error.command}`);
    }

    console.error('\n💡 Common fixes:');
    console.error('   1. Verify GMAIL_USER and GMAIL_APP_PASSWORD are correct');
    console.error('   2. Ensure 2-Step Verification is enabled on Gmail account');
    console.error('   3. Generate a new App Password from Google Account settings');
    console.error('   4. Check if Gmail account is locked or restricted');
    
    process.exit(1);
  }
}

testEmail();

