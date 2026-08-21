import { z } from 'zod';

export const quizQuestionsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({ testType: z.enum(['PRE', 'POST']), sessionId: z.string().min(1) }),
  params: z.object({}).optional(),
});

export const quizStartSchema = z.object({
  body: z.object({ testType: z.enum(['PRE', 'POST']), sessionId: z.string().min(1) }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const quizSubmitSchema = z.object({
  body: z.object({
    attemptId: z.string().min(1),
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
  params: z.object({}).optional(),
});

export const quizResultParamsSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ attemptId: z.string().min(1) }),
});
