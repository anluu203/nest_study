import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GLOBAL_API_PREFIX } from './core/constants/api.constants';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // URL của Frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // Thiết lập global prefix cho tất cả các API routes
  app.setGlobalPrefix(GLOBAL_API_PREFIX);

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Computer Parts E-commerce API')
    .setDescription('API documentation for the computer parts store')
    .setVersion('1.0')
    .addTag('Authentication', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Stores', 'Store management endpoints')
    .addTag('Category Parents', 'Top-level product categories')
    .addTag('Categories', 'Product categories')
    .addTag('Products', 'Product catalog')
    .addTag('Orders', 'Cart, checkout and customer orders')
    .addTag('Admin Orders', 'Administrative order management')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(process.env.PORT || 8080);
  console.log(
    `Application is running on: http://${process.env.HOST || 'localhost'}:${process.env.PORT || 8080}`,
  );
  console.log(
    `Swagger documentation available at: http://${process.env.HOST || 'localhost'}:${process.env.PORT || 8080}/api-docs`,
  );
}
void bootstrap();
