# 🔧 SnapFit Server

<div align="center">
  <img src="../docs/assets/backend-logo.png" alt="Backend Logo" width="100" height="100">
  
  **NestJS API Server for SnapFit**
  
  [![API Status](https://img.shields.io/badge/API-Ready-brightgreen.svg)](#)
  [![Documentation](https://img.shields.io/badge/Swagger-Available-blue.svg)](#)
  [![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)](#)
</div>

## 📖 Overview

The SnapFit backend is a robust NestJS API server that powers the AI-driven fitness platform. It handles user authentication, workout generation, progress tracking, and integrates with various third-party services.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6.0+
- OpenAI API Key
- Gmail App Password
- Paystack API Keys

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/snapfit.git
cd snapfit/backend

# Install dependencies
npm install

# Copy environment variables
cp env.example .env

# Configure your environment variables (see Environment Setup)
# Start the development server
npm run start:dev
```

The API will be available at `http://localhost:3000`

## 🔧 Environment Setup

Create a `.env` file in the backend directory with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/snapfit

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_REFRESH_EXPIRES_IN=30d

# OpenAI Integration
OPENAI_API_KEY=your-openai-api-key-here

# Payment Processing
PAYSTACK_SECRET_KEY=your-paystack-secret-key-here
PAYSTACK_PUBLIC_KEY=your-paystack-public-key-here

# File Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Email Service (Gmail SMTP)
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# App Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Free Trial Configuration
FREE_TRIAL_DAYS=5
FREE_TRIAL_INSTRUCTIONS=1

# Subscription Pricing (in kobo for Paystack)
WEEKLY_PRICE=150000
MONTHLY_PRICE=500000
YEARLY_PRICE=40000000

# Subscription Limits
WEEKLY_INSTRUCTIONS_LIMIT=10
MONTHLY_INSTRUCTIONS_LIMIT=50
YEARLY_INSTRUCTIONS_LIMIT=999999
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── auth/                 # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── guards/           # JWT guards
│   │   └── strategies/       # Passport strategies
│   ├── users/                # User management
│   ├── workouts/             # Workout generation
│   ├── ai/                   # AI integration
│   ├── payments/             # Payment processing
│   ├── subscriptions/        # Subscription management
│   ├── progress/             # Progress tracking
│   ├── media/                # File upload handling
│   ├── admin/                # Admin functionality
│   ├── common/               # Shared utilities
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── schemas/          # MongoDB schemas
│   │   └── services/         # Shared services
│   ├── app.module.ts         # Root module
│   └── main.ts               # Application entry point
├── dist/                     # Compiled JavaScript
├── env.example               # Environment variables template
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh access token
- `POST /auth/verify-email` - Email verification
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset with OTP
- `POST /auth/google` - Google OAuth authentication
- `GET /auth/profile` - Get user profile

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `PUT /users/body-photo` - Upload body photo
- `PUT /users/equipment-photos` - Upload equipment photos
- `PUT /users/complete-onboarding` - Complete onboarding

### Workouts
- `GET /workouts/current` - Get current workout plan
- `POST /workouts/generate` - Generate new workout plan
- `GET /workouts/history` - Get workout history
- `PUT /workouts/:id/complete` - Mark workout as complete

### AI Services
- `POST /ai/analyze-body` - Analyze body photos
- `POST /ai/analyze-equipment` - Analyze equipment photos
- `POST /ai/generate-instructions` - Generate exercise instructions

### Payments
- `POST /payments/initialize` - Initialize payment
- `POST /payments/verify` - Verify payment
- `GET /payments/history` - Get payment history

### Subscriptions
- `GET /subscriptions/current` - Get current subscription
- `POST /subscriptions/upgrade` - Upgrade subscription
- `POST /subscriptions/cancel` - Cancel subscription

## 🗄️ Database Schema

### User Schema
```typescript
{
  email: string (unique, required)
  password: string (required)
  firstName: string
  lastName: string
  isEmailVerified: boolean (default: false)
  emailVerificationToken: string
  emailVerificationExpires: Date
  passwordResetToken: string
  passwordResetExpires: Date
  age: number
  height: number
  weight: number
  fitnessGoal: enum
  experienceLevel: enum
  workoutHistory: enum
  bodyPhotos: {
    front: string
    back: string
    left: string
    fullBody: string
  }
  equipmentPhotos: string[]
  onboardingCompleted: boolean
  subscription: Subscription
  freeTrialUsed: boolean
  instructionsPurchased: number
  googleId: string
  facebookId: string
  isActive: boolean (default: true)
  createdAt: Date
  updatedAt: Date
}
```

### Workout Schema
```typescript
{
  userId: ObjectId (required)
  title: string
  description: string
  weekNumber: number
  days: [{
    dayNumber: number
    name: string
    isRestDay: boolean
    estimatedDuration: number
    exercises: [{
      name: string
      category: string
      sets: number
      reps: number
      weight: number
      duration: number
      restTime: number
      difficulty: number
      description: string
      instructions: string
      tips: string
    }]
  }]
  aiAnalysis: Object
  createdAt: Date
  updatedAt: Date
}
```

## 🔐 Authentication Flow

1. **Registration**: User registers with email/password
2. **Email Verification**: Verification email sent with token
3. **Login**: User logs in after email verification
4. **JWT Tokens**: Access token (7 days) + Refresh token (30 days)
5. **Social Auth**: Google OAuth integration available

## 🤖 AI Integration

### OpenAI GPT-4 Integration
- **Body Analysis**: Analyzes uploaded body photos
- **Equipment Recognition**: Identifies available equipment
- **Workout Generation**: Creates personalized workout plans
- **Instruction Generation**: Provides detailed exercise instructions

### AI Endpoints
- `POST /ai/analyze-body` - Analyze body composition and form
- `POST /ai/analyze-equipment` - Identify available equipment
- `POST /ai/generate-workout` - Generate personalized workout plan
- `POST /ai/generate-instructions` - Create exercise instructions

## 💳 Payment Integration

### Paystack Integration
- **Subscription Management**: Weekly, monthly, yearly plans
- **Payment Processing**: Secure payment handling
- **Webhook Support**: Real-time payment verification
- **Refund Handling**: Automated refund processing

### Pricing Structure
- **Free Trial**: 5 days with 1 instruction generation
- **Weekly**: ₦1,500 (10 instruction generations)
- **Monthly**: ₦5,000 (50 instruction generations)
- **Yearly**: ₦400,000 (Unlimited instruction generations)

## 📧 Email Service

### Gmail SMTP Integration
- **Verification Emails**: Beautiful HTML templates
- **Password Reset**: OTP-based reset system
- **Welcome Emails**: Post-verification welcome messages
- **Notification Emails**: Workout reminders and updates

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run test coverage
npm run test:cov
```

## 🚀 Deployment

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Docker
```bash
docker build -t snapfit-backend .
docker run -p 3000:3000 snapfit-backend
```

## 📊 API Documentation

### Swagger Documentation
Once the server is running, visit:
- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.com/api`

### Postman Collection
Import the Postman collection from `docs/postman/SnapFit-API.postman_collection.json`

## 🔍 Monitoring & Logging

- **Health Checks**: `/health` endpoint
- **Logging**: Winston logger with different levels
- **Error Tracking**: Comprehensive error handling
- **Performance**: Request/response timing

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Generate migration
npm run migration:generate

# Run migrations
npm run migration:run
```

## 📚 Additional Resources

- **[Complete Project Documentation →](../docs/README.md)**
- **[Mobile App Documentation →](../mobile/README.md)**
- **[API Documentation →](../docs/API.md)**
- **[Database Schema →](../docs/DATABASE.md)**
- **[Deployment Guide →](../docs/DEPLOYMENT.md)**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
  <p>
    <a href="../README.md">🏠 Back to Main</a> •
    <a href="../mobile/README.md">📱 Mobile App</a> •
    <a href="../docs/README.md">📚 Documentation</a>
  </p>
</div>
