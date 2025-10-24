import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Set global prefix for all routes, excluding health endpoints
  app.setGlobalPrefix('api', { exclude: ['health', 'health/simple'] });

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Add a simple root endpoint for health checks
  app.getHttpAdapter().get('/', (req, res) => {
    res.json({
      message: 'SnapFit API is running!',
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        docs: '/api/docs',
        auth: '/api/auth',
        users: '/api/users',
        workouts: '/api/workouts'
      }
    });
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SnapFit API')
    .setDescription('AI-Powered Personal Workout Planner API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);


  const port = parseInt(process.env.PORT, 10) || 3000;
  
  try {
    await app.listen(port, '0.0.0.0');
    
    // Get the actual host URL for production
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    
    console.log(`🚀 SnapFit Backend running on port ${port}`);
    console.log(`📚 API Documentation: ${host}/api/docs`);
    console.log(`🔍 Test endpoint: ${host}/`);
    console.log(`🏥 Health check: ${host}/health`);
    console.log(`🏥 API Health check: ${host}/api/health`);
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
}

bootstrap();
