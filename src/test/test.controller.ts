import { Controller, Get } from '@nestjs/common';

@Controller()
export class TestController {
  @Get()
  getApiInfo() {
    return {
      message: 'SnapFit API is running!',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        users: '/api/users',
        docs: '/api/docs'
      }
    };
  }
}
