import { FastifyInstance } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

export default async function (server: FastifyInstance) {
  // We use a Map to keep track of active transports per session.
  // In a distributed environment, this would need Redis, but for MVP local/single-node memory is fine.
  const activeTransports = new Map<string, SSEServerTransport>();

  // Helper to init the server tools once per request context
  const getMcpServer = (request: any) => {
    const mcp = new McpServer({
      name: 'convocarry-mcp',
      version: '1.0.0'
    });

    const user = request.user;
    const apiKey = request.apiKey;

    const enforceScope = async (targetTeamId?: string) => {
      const plan = user.getEffectivePlan(targetTeamId);
      if (plan === 'FREE') throw new Error('MCP requires PRO or TEAM plan');
      if (apiKey.teamId && apiKey.teamId !== targetTeamId) {
        throw new Error('API Key team scope mismatch');
      }
      if (targetTeamId && plan !== 'TEAM') {
        throw new Error('Team scope requires TEAM plan and membership');
      }
      return plan;
    };

    // Tool: list_carry_cards
    mcp.tool('list_carry_cards', {
      query: z.string().optional(),
      platform: z.string().optional(),
      teamId: z.string().optional(),
      limit: z.number().max(50).optional()
    }, async (args) => {
      await enforceScope(args.teamId);
      const where: any = { deletedAt: null };
      if (args.teamId) {
        where.teamFolderId = { not: null };
        where.teamFolder = { teamId: args.teamId };
      } else {
        where.ownerId = user.id;
      }
      if (args.platform) where.currentVersion = { platform: args.platform };
      if (args.query) {
        where.OR = [
          { title: { contains: args.query, mode: 'insensitive' } },
          { tags: { has: args.query } }
        ];
      }

      const cards = await server.prisma.carryCard.findMany({
        where,
        take: args.limit || 20,
        orderBy: { updatedAt: 'desc' },
        include: { currentVersion: true }
      });

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_list_carry_cards', metadata: { apiKeyId: apiKey.id } }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(cards.map(c => ({
            id: c.id,
            title: c.title,
            sourcePlatform: c.currentVersion?.platform,
            tags: c.tags,
            sourceAccountLabel: c.currentVersion?.sourceAccountLabel,
            currentVersionId: c.currentVersionId,
            updatedAt: c.updatedAt
          })))
        }]
      };
    });

    // Tool: get_carry_card
    mcp.tool('get_carry_card', {
      carryCardId: z.string(),
      versionId: z.string().optional()
    }, async (args) => {
      const card = await server.prisma.carryCard.findUnique({
        where: { id: args.carryCardId },
        include: { teamFolder: true }
      });
      if (!card || card.deletedAt) throw new Error('Card not found');
      await enforceScope(card.teamFolder?.teamId);

      const version = await server.prisma.carryCardVersion.findUnique({
        where: { id: args.versionId || card.currentVersionId! }
      });
      if (!version) throw new Error('Version not found');

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_get_carry_card', metadata: { apiKeyId: apiKey.id, cardId: card.id } }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: card.id,
            title: card.title,
            tags: card.tags,
            sourcePlatform: version.platform,
            contextBody: version.contextBody,
            sourceAccountLabel: version.sourceAccountLabel,
            versionId: version.id,
            createdAt: version.createdAt
          })
        }]
      };
    });

    // Tool: search_carry_cards
    mcp.tool('search_carry_cards', {
      query: z.string(),
      teamId: z.string().optional(),
      limit: z.number().max(50).optional()
    }, async (args) => {
      await enforceScope(args.teamId);
      const where: any = { deletedAt: null };
      if (args.teamId) {
        where.teamFolderId = { not: null };
        where.teamFolder = { teamId: args.teamId };
      } else {
        where.ownerId = user.id;
      }

      where.OR = [
        { title: { contains: args.query, mode: 'insensitive' } },
        { tags: { has: args.query } },
        { currentVersion: { contextBody: { string_contains: args.query } } } // Prisima JSON search limitation placeholder
      ];

      const cards = await server.prisma.carryCard.findMany({
        where,
        take: args.limit || 10,
        orderBy: { updatedAt: 'desc' },
        include: { currentVersion: true }
      });

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_search_carry_cards', metadata: { apiKeyId: apiKey.id } }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(cards.map(c => ({
            id: c.id,
            title: c.title,
            tags: c.tags,
            contextBodySnippet: String(c.currentVersion?.contextBody).substring(0, 200) + '...'
          })))
        }]
      };
    });

    // Tool: create_carry_card
    mcp.tool('create_carry_card', {
      title: z.string(),
      contextBody: z.string(),
      sourcePlatform: z.string().optional(),
      tags: z.array(z.string()).optional(),
      teamId: z.string().optional()
    }, async (args) => {
      await enforceScope(args.teamId);

      const teamFolderId = null; // Mock resolution logic for MVP

      const card = await server.prisma.carryCard.create({
        data: {
          ownerId: user.id,
          title: args.title,
          tags: args.tags || [],
          teamFolderId
        }
      });

      const version = await server.prisma.carryCardVersion.create({
        data: {
          carryCardId: card.id,
          contextBody: args.contextBody,
          platform: args.sourcePlatform || 'mcp',
        }
      });

      await server.prisma.carryCard.update({
        where: { id: card.id },
        data: { currentVersionId: version.id }
      });

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_create_carry_card', metadata: { apiKeyId: apiKey.id } }
      });

      return {
        content: [{ type: 'text', text: `Successfully created card ${card.id}` }]
      };
    });

    // Tool: create_carry_card_version
    mcp.tool('create_carry_card_version', {
      carryCardId: z.string(),
      contextBody: z.string(),
      parentVersionId: z.string().optional()
    }, async (args) => {
      const card = await server.prisma.carryCard.findUnique({
        where: { id: args.carryCardId },
        include: { teamFolder: true }
      });
      if (!card || card.deletedAt) throw new Error('Card not found');
      await enforceScope(card.teamFolder?.teamId);

      const version = await server.prisma.carryCardVersion.create({
        data: {
          carryCardId: card.id,
          contextBody: args.contextBody,
          platform: 'mcp',
          parentId: args.parentVersionId || card.currentVersionId
        }
      });

      await server.prisma.carryCard.update({
        where: { id: card.id },
        data: { currentVersionId: version.id }
      });

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_create_carry_card_version', metadata: { apiKeyId: apiKey.id } }
      });

      return {
        content: [{ type: 'text', text: `Successfully created version ${version.id}` }]
      };
    });

    // Tool: get_latest_carry_card
    mcp.tool('get_latest_carry_card', {
      platform: z.string().optional(),
      teamId: z.string().optional()
    }, async (args) => {
      await enforceScope(args.teamId);
      const where: any = { deletedAt: null };
      if (args.teamId) {
        where.teamFolderId = { not: null };
        where.teamFolder = { teamId: args.teamId };
      } else {
        where.ownerId = user.id;
      }
      if (args.platform) where.currentVersion = { platform: args.platform };

      const card = await server.prisma.carryCard.findFirst({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { currentVersion: true }
      });

      if (!card) throw new Error('No cards found');

      await server.prisma.usageEvent.create({
        data: { userId: user.id, eventType: 'mcp_get_latest_carry_card', metadata: { apiKeyId: apiKey.id } }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: card.id,
            title: card.title,
            tags: card.tags,
            contextBody: card.currentVersion?.contextBody
          })
        }]
      };
    });

    return mcp;
  };

  const rateLimits = new Map<string, { count: number, resetAt: number }>();
  
  function checkMcpRateLimit(apiKeyId: string): boolean {
    const now = Date.now();
    const entry = rateLimits.get(apiKeyId);
    if (!entry || entry.resetAt < now) {
      rateLimits.set(apiKeyId, { count: 1, resetAt: now + 60000 }); // 1 min window
      return true;
    }
    if (entry.count >= 60) return false; // max 60 tool calls per minute per API key
    entry.count++;
    return true;
  }

  // Streamable HTTP endpoint
  server.post('/mcp', { preValidation: [server.requireApiKey] }, async (request, reply) => {
    // Rate limit per API Key
    if (!checkMcpRateLimit(request.apiKey!.id)) {
      return reply.code(429).send({ error: 'Too Many Requests', message: 'MCP Rate limit exceeded' });
    }

    // Validate Origin
    const origin = request.headers.origin;
    if (origin && origin === '*') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Wildcard CORS not permitted for MCP' });
    }

    const mcp = getMcpServer(request);
    
    // Fallback/hypothetical Streamable HTTP transport implementation 
    // If official SDK exposes a StreamableHttpTransport, it would be wired here.
    // For now, we process JSON-RPC requests directly on the stream.
    
    // In a true implementation with @modelcontextprotocol/sdk, you'd wire the streams:
    // const transport = new StdioServerTransport(); // adapted for HTTP stream
    // await mcp.connect(transport);
    
    // For scaffolding MVP, we simulate the connection over Fastify request/reply
    reply.header('Content-Type', 'application/json');
    reply.header('Transfer-Encoding', 'chunked');

    try {
      const body: any = request.body;
      if (!body) return reply.code(400).send({ error: 'Bad Request', message: 'Missing JSON-RPC payload' });

      // We use the underlying Server instance of McpServer
      const response = await mcp.server.request(body, z.any());
      return response;
    } catch (e: any) {
      server.log.error(e);
      return reply.code(500).send({ error: 'Internal Server Error', message: e.message });
    }
  });
}
