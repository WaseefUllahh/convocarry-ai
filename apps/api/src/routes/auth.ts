import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

const exchangeSchema = z.object({
  token: z.string().min(1).max(8192),
});

export default async function (server: FastifyInstance) {
  server.post('/exchange', async (request, reply) => {
    const bodyResult = exchangeSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Bad Request', details: bodyResult.error.format() });
    }

    const { token } = bodyResult.data;
    if (!env.GOOGLE_CLIENT_ID) {
      return reply.code(503).send({ error: 'Google sign-in is not configured' });
    }

    try {
      // 1. Verify Google Token
      const query = new URLSearchParams({ access_token: token });
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?${query}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid Google OAuth token' });
      }

      const tokenInfo = await response.json();
      if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID || !(Number(tokenInfo.expires_in) > 0)) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid OAuth audience or expired token' });
      }
      
      // 2. Validate Claims
      // [PRODUCTION NOTE]: Replace tokeninfo with official google-auth-library or OIDC ID-token flow for reliability.
      if (tokenInfo.email_verified !== 'true' && tokenInfo.email_verified !== true) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Email not verified' });
      }

      if (!tokenInfo.email || !tokenInfo.sub) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Missing email or sub claim' });
      }

      // 3. Upsert User
      const user = await server.prisma.user.upsert({
        where: { authProviderId: tokenInfo.sub },
        update: {
          email: tokenInfo.email,
        },
        create: {
          authProviderId: tokenInfo.sub,
          email: tokenInfo.email,
          authProvider: 'google',
        },
        include: {
          subscription: true
        }
      });

      // 4. Issue ConvoCarry JWT
      const sessionToken = jwt.sign(
        { sub: user.authProviderId, email: user.email },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] }
      );

      return reply.code(200).send({
        token: sessionToken,
        expiresAt: new Date((jwt.decode(sessionToken) as jwt.JwtPayload).exp! * 1000).toISOString(),
        user: {
          id: user.id,
          email: user.email,
          plan: user.subscription?.plan || 'FREE'
        }
      });

    } catch (err) {
      // A fetch error can contain a token-bearing URL; never log the raw exception.
      server.log.error('Google token exchange failed');
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // DEV ONLY: Seeded bypass login
  server.post('/dev-login', async (request, reply) => {
    if (env.NODE_ENV === 'production' || env.ENABLE_DEV_LOGIN !== 'true') {
      return reply.code(404).send({ error: 'Not Found' });
    }

    try {
      const devEmail = 'dev_free_user@convocarry.local';
      const devSubId = 'dev-local-12345';

      const user = await server.prisma.user.upsert({
        where: { authProviderId: devSubId },
        update: {},
        create: {
          authProviderId: devSubId,
          email: devEmail,
          authProvider: 'google', // mock
        },
        include: {
          subscription: true
        }
      });

      const sessionToken = jwt.sign(
        { sub: user.authProviderId, email: user.email },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] }
      );

      return reply.code(200).send({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          plan: user.subscription?.plan || 'FREE'
        }
      });
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
