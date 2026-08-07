import { z } from 'zod';

export const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(2000),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().min(1).max(4000),
        })
      )
      .max(20)
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
