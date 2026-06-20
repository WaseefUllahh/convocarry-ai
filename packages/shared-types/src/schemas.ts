import { z } from 'zod';

export const ConversationNodeSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'unknown']),
  text: z.string(),
  timestamp: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  sourceUrl: z.string().url().optional(),
});

export const CreateCarryCardInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  teamFolderId: z.string().cuid().optional(),
});
export type CreateCarryCardInput = z.infer<typeof CreateCarryCardInputSchema>;

export const CreateCarryCardVersionInputSchema = z.object({
  carryCardId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  contextBody: z.array(ConversationNodeSchema),
  rawSnapshot: z.any().optional(),
  sourceAccountLabel: z.string().max(100).optional(),
  platform: z.string(),
});
export type CreateCarryCardVersionInput = z.infer<typeof CreateCarryCardVersionInputSchema>;

export const ShareCarryCardInputSchema = z.object({
  cardId: z.string().cuid(),
  targetEmail: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  maxClaims: z.number().int().min(1).optional(),
});
export type ShareCarryCardInput = z.infer<typeof ShareCarryCardInputSchema>;

export const ClaimCarryCardInputSchema = z.object({
  token: z.string().min(1),
  teamFolderId: z.string().cuid().optional(),
});
export type ClaimCarryCardInput = z.infer<typeof ClaimCarryCardInputSchema>;

export const InjectPayloadSchema = z.object({
  cardId: z.string().cuid(),
  versionId: z.string().cuid().optional(),
  mode: z.enum(['summary', 'full_continuation']),
  targetApp: z.string(),
});
export type InjectPayload = z.infer<typeof InjectPayloadSchema>;
