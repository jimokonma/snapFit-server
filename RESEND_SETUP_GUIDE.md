# Resend API Setup Guide - Fix Invalid API Key Error

## The Problem

You're getting this error:
```
❌ Resend API returned an error:
  "statusCode": 401,
  "name": "validation_error",
  "message": "API key is invalid"
```

This means your `RESEND_API_KEY` in Render.com is either:
- Not set correctly
- Invalid/expired
- Has extra spaces or characters

## Step-by-Step Fix

### 1. Get a Valid Resend API Key

1. **Go to Resend Dashboard**: https://resend.com
2. **Sign up or Log in** (free tier: 3,000 emails/month)
3. **Navigate to API Keys**:
   - Click on your profile/account menu
   - Go to "API Keys" section
4. **Create a New API Key**:
   - Click "Create API Key"
   - Give it a name: "SnapFit Production"
   - Copy the key immediately (it starts with `re_` and looks like: `re_123456789abcdef...`)
   - ⚠️ **Important**: You can only see it once! Copy it now.

### 2. Verify Your API Key Format

A valid Resend API key:
- Starts with `re_`
- Is about 40-50 characters long
- Example: `re_AbCdEf1234567890XyZ...`

### 3. Add to Render.com Environment Variables

1. **Go to Render.com Dashboard**
2. **Select your `snapfit-backend` service**
3. **Go to "Environment" tab**
4. **Update `RESEND_API_KEY`**:
   - Find `RESEND_API_KEY` in the list
   - Click "Edit" or delete and recreate it
   - **Paste your API key exactly** (no spaces before/after)
   - Click "Save"
5. **Set `RESEND_FROM_EMAIL`** (if not set):
   - Add: `RESEND_FROM_EMAIL` = `onboarding@resend.dev`
   - Or use your verified domain email

### 4. Verify Domain (Optional but Recommended)

For production, verify your domain in Resend:

1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Add your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides to your domain
5. Wait for verification (usually a few minutes)
6. Use `noreply@yourdomain.com` as `RESEND_FROM_EMAIL`

### 5. Restart Your Service

After updating environment variables:
1. Go to "Manual Deploy" tab
2. Click "Deploy latest commit"
   OR
3. The service should auto-restart

### 6. Verify It's Working

Check your Render.com logs. You should see:
```
🔍 Email Service Configuration Check:
   RESEND_API_KEY: SET (re_1234***)
✅ Resend API initialized (will verify on first send)
```

When you send an email, you should see:
```
📨 Resend API Response: {
  "data": {
    "id": "abc123..."
  }
}
✅ Verification email sent successfully
```

## Troubleshooting

### Still Getting "API key is invalid"?

1. **Double-check the key**:
   - Make sure it starts with `re_`
   - No extra spaces or line breaks
   - Copy-paste directly from Resend dashboard

2. **Verify in Render.com**:
   - Go to Environment tab
   - Check `RESEND_API_KEY` value (it will be hidden, but you can edit it)
   - Make sure there are no quotes around it

3. **Test the API key**:
   ```bash
   curl https://api.resend.com/emails \
     -H "Authorization: Bearer re_YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "onboarding@resend.dev",
       "to": "your-email@example.com",
       "subject": "Test",
       "html": "<p>Test email</p>"
     }'
   ```

### Alternative: Use SendGrid

If Resend doesn't work for you, here's SendGrid setup:

1. **Sign up**: https://sendgrid.com
2. **Create API Key**: Settings → API Keys → Create API Key
3. **Install**: `npm install @sendgrid/mail`
4. **Add to Render.com**: `SENDGRID_API_KEY` = your key
5. **Update code** to use SendGrid instead

## Quick Test

After setup, test with curl:

```bash
curl -X POST https://snapfit-server.onrender.com/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

Check logs for successful email send!

## Why This is Necessary

**Render.com blocks SMTP ports** (25, 465, 587) for security. This is why Gmail SMTP times out. API-based services like Resend use HTTPS (port 443) which is always allowed.

**Resend is the easiest solution** because:
- ✅ Free tier: 3,000 emails/month
- ✅ Simple API
- ✅ Already integrated in your code
- ✅ Works perfectly on Render.com
- ✅ No SMTP port issues

