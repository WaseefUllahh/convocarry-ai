import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import rawBody from 'fastify-raw-body';

import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';

const server = Fastify({
  logger: {
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
    } : undefined
  }
});

// Global Error Handler
server.setErrorHandler(function (error, request, reply) {
  this.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message
  });
});

async function build() {
  await server.register(cors, {
    origin: [env.APP_BASE_URL, env.EXTENSION_ID ? `chrome-extension://${env.EXTENSION_ID}` : ''].filter(Boolean),
    credentials: true,
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register plugins
  await server.register(rawBody, {
    field: 'rawBody', // request.rawBody
    global: false,    // Only on routes with { config: { rawBody: true } }
    encoding: 'utf8', 
    runFirst: true    // Parse raw before JSON
  });
  await server.register(prismaPlugin);
  await server.register(authPlugin);

  // Register routes
  await server.register(healthRoutes);
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register((await import('./routes/cards')).default, { prefix: '/api/v1/cards' });
  await server.register((await import('./routes/sync')).default, { prefix: '/api/v1/sync' });
  await server.register((await import('./routes/internal')).default, { prefix: '/api/v1/internal' });
  await server.register((await import('./routes/billing')).default, { prefix: '/api/v1/billing' });
  await server.register((await import('./routes/handoff')).default, { prefix: '/api/v1' });
  await server.register((await import('./routes/api-keys')).default, { prefix: '/api/v1' });
  await server.register((await import('./routes/mcp')).default);
  await server.register((await import('./routes/support')).default, { prefix: '/api/v1/support' });
  await server.register((await import('./routes/events')).default, { prefix: '/api/v1' });


  return server;
}

// Start the server if this file is the entry point
const isMain = typeof process !== 'undefined' && process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));
if (isMain) {
  build().then(app => {
    app.listen({ port: parseInt(env.API_PORT, 10), host: env.API_HOST }, (err, address) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
      app.log.info(`Server listening at ${address}`);
    });
  });
}

export { build };
