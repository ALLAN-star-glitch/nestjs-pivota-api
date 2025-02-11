import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import * as fastifyCors from '@fastify/cors';

async function bootstrap() {
  console.log('Application is starting...')
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  // Enable CORS for all origins (or you can specify the frontend URL if you need)
  app.register(fastifyCors, {
    origin: (origin, cb) => {
    const allowedOrigins = ['https://pivota.vercel.app', 'http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true, // Optional, for handling cookies or tokens
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0'); // Make it accessible externally
}
bootstrap();
