# Email Service Test Script

This script tests the email service on your server by sending actual test emails using the configured email provider (Resend API or Gmail SMTP).

## Running Locally

```bash
# Set environment variables
export TEST_EMAIL=your-email@example.com
export RESEND_API_KEY=re_your-api-key  # Optional - for Resend
export RESEND_FROM_EMAIL=onboarding@resend.dev  # Optional
export GMAIL_USER=your-gmail@gmail.com  # Optional - fallback
export GMAIL_APP_PASSWORD=your-app-password  # Optional - fallback

# Run the test
npm run test:email
```

## Running on Render.com Server

### Option 1: Using Render Shell (Recommended)

1. Go to your Render.com dashboard
2. Navigate to your `snapfit-backend` service
3. Click on "Shell" tab (or use the terminal icon)
4. Run the following commands:

```bash
# Navigate to the backend directory (if not already there)
cd backend

# Set the test email (replace with your email)
export TEST_EMAIL=your-email@example.com

# Run the test script
npm run test:email
```

### Option 2: Using SSH (if enabled)

```bash
# SSH into your Render service
ssh your-service-name@render.com

# Navigate to backend directory
cd backend

# Set environment variables
export TEST_EMAIL=your-email@example.com

# Run the test
npm run test:email
```

### Option 3: Direct Node Execution

If npm scripts don't work, you can run it directly:

```bash
cd backend
node -r ts-node/register test-email-service.ts
```

Or if you've built the project:

```bash
cd backend
npm run build
node dist/test-email-service.js
```

## What the Test Does

The script tests three email types:

1. **Verification Email** - Tests the signup email verification flow
2. **Password Reset Email** - Tests the forgot password flow  
3. **Welcome Email** - Tests the welcome email sent after verification

Each test:
- Generates a random OTP code
- Sends the email using your configured provider (Resend or Gmail SMTP)
- Logs success/failure with detailed error messages
- Displays the OTP codes for verification

## Expected Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing Email Service on Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration Check:
   RESEND_API_KEY: SET (re_1234***)
   RESEND_FROM_EMAIL: onboarding@resend.dev
   GMAIL_USER: ❌ NOT SET
   GMAIL_APP_PASSWORD: ❌ NOT SET
   TEST_EMAIL: your-email@example.com

✅ Email service initialized

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 TEST 1: Verification Email (Signup Flow)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Verification email sent successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All Email Service Tests Completed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Troubleshooting

### If tests fail:

1. **Check Environment Variables**
   - Verify `RESEND_API_KEY` is set correctly (if using Resend)
   - Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set (if using Gmail)
   - Verify `TEST_EMAIL` is set to a valid email address

2. **Check Email Provider**
   - For Resend: Verify API key is valid in Resend dashboard
   - For Gmail: Verify app password is correct and 2FA is enabled

3. **Check Server Logs**
   - Look for detailed error messages in the test output
   - Check Render.com logs for additional context

4. **Verify Email Delivery**
   - Check spam/junk folder
   - Verify email address is correct
   - Wait a few minutes for email delivery

## Notes

- The script uses the actual `EmailService` class, so it tests the exact implementation used in production
- OTPs are logged to console for manual verification if emails fail
- The script exits with code 0 on success, 1 on failure
- All three email types are tested sequentially with a 2-second delay between each

