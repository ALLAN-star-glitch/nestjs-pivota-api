import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie'; // Corrected import for fastify-cookie;
import helmet from '@fastify/helmet'; // Import Fastify Helmet
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  console.log('Application is starting...');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS for frontend
  app.register(fastifyCors, {
    origin: (origin, cb) => {
      //This is to allow apps from vercel and render to consume the api endpoints for testing purposes and debugging
      const allowedOrigins = ['https://pivota-expressjs-platform.onrender.com', 'http://localhost:3000', 'https://pivota.vercel.app/'];
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true,
  });

  // Register fastify-cookie for handling cookies
  app.register(fastifyCookie);

  // Register Helmet with correct CSP settings for Swagger
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`, `https:`],
      },
    },
  });

 // Swagger configuration using DocumentBuilder
 const options = new DocumentBuilder()
 .setTitle('Pivota API') // Title for your API documentation
 .setDescription('API documentation for the Pivota platform') // Description of your API
 .setVersion('1.0') // API version
 .addServer('http://localhost:4000/', 'Local environment') // Local server
 .addServer('https://nestjs-pivota-api.onrender.com/', 'Production environment') // Production server (replace with actual URL)
 .addTag('Auth', 'Authentication endpoints') // Add tags for grouping API endpoints
 .addTag('Users', 'User-related endpoints') // Another tag for grouping
 .build();

 const document = SwaggerModule.createDocument(app, options);

 // Serve the Swagger UI at /api-docs
 SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');

  console.log(`Swagger running at http://localhost:${port}/api-docs`);
}

bootstrap();
