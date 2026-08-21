import { z } from 'zod';

export const practiceStartSessionSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ module: z.string().min(1) }),
});

export const practiceSubmitSchema = z.object({
  body: z.object({
    responses: z
      .array(
        z.object({
          questionId: z.string().min(1),
          selectedOption: z.enum(['A', 'B', 'C', 'D']),
        })
      )
      .min(1),
  }),
  query: z.object({}).optional(),
  params: z.object({ sessionId: z.string().min(1) }),
});
