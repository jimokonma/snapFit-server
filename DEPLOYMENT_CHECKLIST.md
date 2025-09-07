# 🚀 Render Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] All code committed and pushed to GitHub
- [ ] `render.yaml` file created
- [ ] `Dockerfile` created
- [ ] `.dockerignore` file created
- [ ] Health check endpoint added (`/health`)
- [ ] Build command tested locally (`npm run build`)

### ✅ Environment Variables Ready
- [ ] MongoDB connection string
- [ ] JWT secrets (strong, unique values)
- [ ] OpenAI API key
- [ ] Paystack keys (test/live)
- [ ] Cloudinary credentials
- [ ] Gmail credentials
- [ ] Google OAuth credentials (optional)
- [ ] Facebook OAuth credentials (optional)

### ✅ Database Setup
- [ ] MongoDB Atlas cluster created
- [ ] Database user created with proper permissions
- [ ] Network access configured (0.0.0.0/0 for Render) 
- [ ] Connection string tested

## Deployment Steps

### 1. Render Setup
- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Create new Web Service
- [ ] Set root directory to `backend`
- [ ] Configure build command: `npm install && npm run build`
- [ ] Configure start command: `npm run start:prod`

### 2. Environment Variables
- [ ] Add all required environment variables in Render dashboard
- [ ] Set `NODE_ENV=production`
- [ ] Set `PORT=10000`
- [ ] Add database URL
- [ ] Add all API keys and secrets

### 3. Deploy
- [ ] Click "Create Web Service"
- [ ] Monitor build logs
- [ ] Wait for deployment to complete

### 4. Verification
- [ ] Test health endpoint: `https://your-app.onrender.com/health`
- [ ] Test API endpoints
- [ ] Check logs for any errors
- [ ] Verify database connection

## Post-Deployment

### ✅ Update Mobile App
- [ ] Update API base URL in mobile app
- [ ] Test mobile app with deployed backend
- [ ] Update any hardcoded URLs

### ✅ Monitoring Setup
- [ ] Set up error monitoring (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up log aggregation
- [ ] Create alerts for critical issues

### ✅ Security
- [ ] Verify HTTPS is working
- [ ] Test authentication endpoints
- [ ] Verify CORS settings
- [ ] Check rate limiting

## Quick Commands

```bash
# Test build locally
npm run build

# Test health endpoint locally
curl http://localhost:3000/health

# Check environment variables
echo $DATABASE_URL
echo $JWT_SECRET
```

## Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify all dependencies in package.json
- Check TypeScript compilation

### Database Connection Issues
- Verify MongoDB connection string
- Check network access in MongoDB Atlas
- Verify database user permissions

### Environment Variable Issues
- Double-check variable names (case-sensitive)
- Verify all required variables are set
- Check for typos in values

## Support Resources

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- [NestJS Deployment](https://docs.nestjs.com/recipes/deployment)

---

**Ready to deploy?** 🚀

Your backend will be available at: `https://your-app-name.onrender.com`
