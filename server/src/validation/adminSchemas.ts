import { z } from 'zod';

export const adminAnalyticsQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    module: z.string().min(1).optional(),
    difficulty: z.string().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  params: z.object({}).optional(),
});

export const adminUsersQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

export const adminExportQuerySchema = adminAnalyticsQuerySchema;
