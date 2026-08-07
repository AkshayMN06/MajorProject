import { z } from 'zod';

export const createSessionSchema = z.object({
  body: z.object({
    difficulty: z.enum(['Easy', 'Medium', 'Hard', 'All']).optional(),
    totalScenarios: z.coerce.number().int().min(2).max(10).optional(),
    module: z.string().min(1).max(100).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const joinSessionSchema = z.object({
  body: z.object({
    sessionCode: z.string().min(4).max(12),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const readySchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const attackSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
    attackOptionId: z.string().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const defenseSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1),
    defenseOptionId: z.string().min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const roundResultQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    sessionId: z.string().min(1),
  }),
  params: z.object({}).optional(),
});
