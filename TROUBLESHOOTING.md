# Troubleshooting Guide

## Login Issues

### Problem: Cannot login with valid credentials

**Root Cause:**
The login system requires email verification. If you registered but didn't verify your email, login will fail with the error: "Please verify your email before logging in."

**Solutions:**

1. **Verify your email:**
   - Check your email inbox (and spam folder) for the verification code
   - Use the verification code in the app to verify your email
   - Or use the resend verification endpoint: `POST /api/auth/resend-verification`

2. **Development Mode (Skip Email Verification):**
   - Add to your `.env` file:
     ```
     SKIP_EMAIL_VERIFICATION=true
     NODE_ENV=development
     ```
   - This will allow login without email verification in development mode only
   - **⚠️ WARNING: Never use this in production!**

3. **Check server logs:**
   - When login fails, check the server console logs
   - You'll see detailed error messages including:
     - Whether user was found
     - Whether password was correct
     - Whether email is verified
     - The verification token (if not verified)

## Email Notification Issues

### Problem: Not receiving email notifications

**Root Causes:**
1. Email credentials not configured in `.env` file
2. Invalid Gmail App Password
3. Email service failing silently

**Solutions:**

1. **Configure Gmail Credentials:**
   - Add to your `.env` file:
     ```
     GMAIL_USER=your-email@gmail.com
     GMAIL_APP_PASSWORD=your-gmail-app-password
     ```
   
2. **Get Gmail App Password:**
   - Go to your Google Account settings
   - Enable 2-Step Verification
   - Go to App Passwords
   - Generate a new app password for "Mail"
   - Use this password (not your regular Gmail password)

3. **Check Server Logs:**
   - When the server starts, you should see:
     - `✅ Email service initialized successfully` (if configured correctly)
     - `⚠️ EMAIL SERVICE WARNING: GMAIL_USER or GMAIL_APP_PASSWORD not configured!` (if not configured)
   
4. **Check Email Sending Logs:**
   - When emails are sent, you'll see:
     - `✅ Verification email sent successfully to email@example.com`
     - `❌ Failed to send verification email: [error message]`
   - If email service is not configured, the OTP will be logged to console:
     - `📧 Verification OTP for email@example.com: 123456`

5. **Common Email Errors:**
   - **"Invalid login"**: Wrong Gmail App Password
   - **"Connection timeout" (ETIMEDOUT)**: Network/firewall issues, especially on cloud platforms like Render.com
   - **"Authentication failed"**: Gmail account security settings blocking access

6. **Render.com / Cloud Platform Issues:**
   - Gmail SMTP connections may be blocked or restricted on some cloud platforms
   - The email service now uses explicit SMTP configuration (port 587 with STARTTLS) and retry logic
   - If Gmail SMTP continues to fail, consider using a transactional email service:
     - **SendGrid** (recommended for production)
     - **Resend** (modern, developer-friendly)
     - **Mailgun** (reliable, good free tier)
     - **AWS SES** (cost-effective at scale)
   - These services provide APIs instead of SMTP and work better on cloud platforms

## Debugging Steps

### 1. Check Environment Variables
```bash
# In backend directory
cat .env | grep GMAIL
cat .env | grep SKIP_EMAIL_VERIFICATION
cat .env | grep NODE_ENV
```

### 2. Check Server Logs
When you try to login or register, check the server console for:
- Login attempts and results
- Email sending status
- Verification tokens
- Error messages

### 3. Test Email Service
```bash
# Check if email service initialized
# Look for: "✅ Email service initialized successfully"
# Or: "⚠️ EMAIL SERVICE WARNING"
```

### 4. Manual Email Verification
If you can't receive emails, check server logs for the OTP:
```
📧 Verification OTP for your-email@example.com: 123456
```

Then manually verify using:
```bash
POST /api/auth/verify-email
{
  "email": "your-email@example.com",
  "otp": "123456"
}
```

### 5. Resend Verification Email
```bash
POST /api/auth/resend-verification
{
  "email": "your-email@example.com"
}
```

## Quick Fixes

### For Development (Skip Email Verification)
Add to `.env`:
```env
SKIP_EMAIL_VERIFICATION=true
NODE_ENV=development
```

### For Production (Fix Email Service)
1. Set up Gmail App Password
2. Add to `.env`:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   ```
3. Restart server
4. Check logs for email service initialization

## Still Having Issues?

1. **Check MongoDB:**
   - Verify user exists: `db.users.findOne({ email: "your-email@example.com" })`
   - Check `isEmailVerified` field
   - Check `emailVerificationToken` field

2. **Check Network:**
   - Ensure server can reach Gmail SMTP servers
   - Check firewall settings
   - Verify internet connection

3. **Check Gmail Settings:**
   - Ensure 2-Step Verification is enabled
   - Verify App Password is correct
   - Check if Gmail account is locked or restricted

