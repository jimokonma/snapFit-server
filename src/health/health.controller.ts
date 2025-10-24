import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  async check() {
    try {
      // Check database connection
      const dbState = this.connection.readyState;
      const isDbConnected = dbState === 1; // 1 = connected

      return {
        status: isDbConnected ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: isDbConnected ? 'connected' : 'disconnected',
          readyState: dbState,
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        error: error.message,
      };
    }
  }

  @Get('simple')
  simple() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

// Add a simple health controller for root-level health checks
@Controller()
export class RootHealthController {
  @Get('health')
  get() {
    return { status: 'ok' };
  }
}
