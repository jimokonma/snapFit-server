# Setting Up Email Service on Render.com

## The Problem

The email service works locally but not on Render.com because **environment variables need to be manually set in the Render.com dashboard**.

The `render.yaml` file only declares which variables are needed, but you must set their actual values in the Render dashboard.

## Step-by-Step Setup

### 1. Get Your Resend API Key (Recommended)

1. Go to https://resend.com and sign up/login
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Give it a name (e.g., "SnapFit Production")
5. Copy the API key (starts with `re_`)

### 2. Add Environment Variables to Render.com

1. Go to your Render.com dashboard
2. Click on your **snapfit-backend** service
3. Go to the **Environment** tab
4. Click **Add Environment Variable** for each:

   **Required:**
   ```
   RESEND_API_KEY = re_your-actual-api-key-here
   ```

   **Optional (but recommended):**
   ```
   RESEND_FROM_EMAIL = onboarding@resend.dev
   ```
   (Or use your verified domain email like `noreply@yourdomain.com`)

### 3. Verify Variables Are Set

After adding the variables, you should see them listed in the Environment tab. They will look like:
- `RESEND_API_KEY` = `re_***` (hidden)
- `RESEND_FROM_EMAIL` = `onboarding@resend.dev`

### 4. Restart Your Service

After adding environment variables:
1. Go to **Manual Deploy** or **Events** tab
2. Click **Manual Deploy** → **Deploy latest commit**
   OR
3. The service should auto-restart when you save environment variables

### 5. Check Server Logs

After restart, check the logs. You should see:
```
📧 Initializing email service with Resend API...
✅ Email service initialized with Resend API
📧 From email: onboarding@resend.dev
```

If you see this instead:
```
⚠️  EMAIL SERVICE WARNING: No email provider configured!
```

Then the `RESEND_API_KEY` environment variable is not set correctly.

## Troubleshooting

### Issue: Still seeing "No email provider configured"

**Solution:**
1. Double-check `RESEND_API_KEY` is set in Render.com Environment tab
2. Make sure there are no extra spaces in the variable value
3. Restart the service after adding variables
4. Check logs to see what the service detects

### Issue: Emails not sending

**Check:**
1. Verify Resend API key is valid (check Resend dashboard)
2. Check if `RESEND_FROM_EMAIL` is verified in Resend
3. Look at server logs for error messages
4. Test with the test script: `npm run test:email`

### Issue: Gmail SMTP still being used

**Why:** If `RESEND_API_KEY` is not set, it falls back to Gmail SMTP (which doesn't work on Render.com)

**Solution:** Make sure `RESEND_API_KEY` is set, and the service will use Resend instead

## Quick Test

After setting up, test the email service:

1. Go to Render.com → Your Service → **Shell** tab
2. Run:
   ```bash
   cd backend
   export TEST_EMAIL=your-email@example.com
   npm run test:email
   ```

You should see:
```
✅ Email service initialized with Resend API
✅ Verification email sent successfully!
```

## Alternative: Using Gmail SMTP (Not Recommended)

If you want to use Gmail instead (may not work on Render.com):

1. Set these in Render.com Environment:
   ```
   GMAIL_USER = your-email@gmail.com
   GMAIL_APP_PASSWORD = your-app-password
   ```

2. **Note:** Gmail SMTP often fails on Render.com due to network restrictions

## Environment Variables Summary

| Variable | Required | Description |
|---------|----------|-------------|
| `RESEND_API_KEY` | ✅ Yes | Your Resend API key (starts with `re_`) |
| `RESEND_FROM_EMAIL` | ⚠️ Recommended | Email address to send from (default: `onboarding@resend.dev`) |
| `GMAIL_USER` | ❌ No | Fallback option (may not work on Render.com) |
| `GMAIL_APP_PASSWORD` | ❌ No | Fallback option (may not work on Render.com) |

## Important Notes

- **Environment variables in `render.yaml` are just declarations** - you must set actual values in Render dashboard
- **Restart required** - Service must restart after adding environment variables
- **Resend is recommended** - Works reliably on Render.com (Gmail SMTP often blocked)
- **Free tier** - Resend gives 3,000 emails/month free

