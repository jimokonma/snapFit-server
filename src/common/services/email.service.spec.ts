import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

// Mock Resend
jest.mock('resend');
const MockedResend = Resend as jest.MockedClass<typeof Resend>;

// Mock nodemailer
jest.mock('nodemailer');
const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('EmailService', () => {
  let service: EmailService;
  let configService: ConfigService;
  let mockResendInstance: any;
  let mockTransporter: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup Resend mock
    mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({
          data: { id: 'test-email-id-123' },
        }),
      },
    };
    MockedResend.mockImplementation(() => mockResendInstance);

    // Setup nodemailer mock
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: jest.fn().mockResolvedValue(true),
    };
    mockedNodemailer.createTransport.mockReturnValue(mockTransporter as any);
  });

  describe('Initialization with Resend', () => {
    it('should initialize with Resend API when RESEND_API_KEY is provided', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          if (key === 'RESEND_FROM_EMAIL') return 'test@example.com';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);

      expect(MockedResend).toHaveBeenCalledWith('re_test_api_key');
      expect(mockConfigService.get).toHaveBeenCalledWith('RESEND_API_KEY');
      expect(mockConfigService.get).toHaveBeenCalledWith('RESEND_FROM_EMAIL');
    });

    it('should use default from email when RESEND_FROM_EMAIL is not provided', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);

      expect(MockedResend).toHaveBeenCalled();
    });
  });

  describe('Initialization with Gmail SMTP', () => {
    it('should initialize with Gmail SMTP when only Gmail credentials are provided', () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'GMAIL_USER') return 'test@gmail.com';
          if (key === 'GMAIL_APP_PASSWORD') return 'test-password';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);

      expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'test-password',
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000,
        requireTLS: true,
        debug: false,
        logger: false,
      });
    });
  });

  describe('Initialization without credentials', () => {
    it('should not initialize any provider when no credentials are provided', () => {
      const mockConfigService = {
        get: jest.fn(() => undefined),
      };

      service = new EmailService(mockConfigService as any);

      expect(MockedResend).not.toHaveBeenCalled();
      expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('sendVerificationEmail with Resend', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          if (key === 'RESEND_FROM_EMAIL') return 'test@example.com';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);
    });

    it('should send verification email via Resend API', async () => {
      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: email,
        subject: 'Verify Your SnapFit Account',
        html: expect.stringContaining(otp),
      });
    });

    it('should log OTP even when email is sent', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempting to send verification email'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Verification OTP: ${otp}`),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sendVerificationEmail with Gmail SMTP', () => {
    beforeEach(() => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'GMAIL_USER') return 'test@gmail.com';
          if (key === 'GMAIL_APP_PASSWORD') return 'test-password';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);
    });

    it('should send verification email via Gmail SMTP', async () => {
      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: email,
        subject: 'Verify Your SnapFit Account',
        html: expect.stringContaining(otp),
      });
    });

    it('should retry on failure', async () => {
      mockTransporter.sendMail
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({ messageId: 'test-message-id' });

      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendPasswordResetEmail', () => {
    beforeEach(() => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          if (key === 'RESEND_FROM_EMAIL') return 'test@example.com';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);
    });

    it('should send password reset email via Resend', async () => {
      const email = 'user@example.com';
      const otp = '654321';

      await service.sendPasswordResetEmail(email, otp);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: email,
        subject: 'Reset Your SnapFit Password',
        html: expect.stringContaining(otp),
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    beforeEach(() => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          if (key === 'RESEND_FROM_EMAIL') return 'test@example.com';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);
    });

    it('should send welcome email via Resend', async () => {
      const email = 'user@example.com';
      const firstName = 'John';

      await service.sendWelcomeEmail(email, firstName);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: email,
        subject: "Welcome to SnapFit - Let's Start Your Fitness Journey!",
        html: expect.stringContaining(firstName),
      });
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RESEND_API_KEY') return 're_test_api_key';
          if (key === 'RESEND_FROM_EMAIL') return 'test@example.com';
          return undefined;
        }),
      };

      service = new EmailService(mockConfigService as any);
    });

    it('should handle Resend API errors gracefully', async () => {
      const error = new Error('Resend API error');
      mockResendInstance.emails.send.mockRejectedValueOnce(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send verification email'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Verification OTP for ${email}: ${otp}`),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log OTP when email service is not configured', async () => {
      const mockConfigService = {
        get: jest.fn(() => undefined),
      };

      service = new EmailService(mockConfigService as any);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const email = 'user@example.com';
      const otp = '123456';

      await service.sendVerificationEmail(email, otp);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send verification email'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Verification OTP for ${email}: ${otp}`),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

