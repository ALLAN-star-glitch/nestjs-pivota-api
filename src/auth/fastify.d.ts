// fastify.d.ts
import 'fastify-cookie';  // Import fastify-cookie types

declare module 'fastify' {
  interface FastifyReply {
    setCookie: (name: string, value: string, options?: FastifyCookieSetOptions) => void;
  }
}
