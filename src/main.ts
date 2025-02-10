import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import * as fastifyCors from '@fastify/cors';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  // Enable CORS for all origins (or you can specify the frontend URL if you need)
  app.register(fastifyCors, {
    origin: 'http://localhost:3000', // You can replace '*' with your frontend URL if needed
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true, // Optional, for handling cookies or tokens
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0'); // Make it accessible externally
}
bootstrap();
