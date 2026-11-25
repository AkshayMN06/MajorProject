import { z } from 'zod';

// Authoring labels map onto the existing difficulty values the student
// Modules dashboard filters on (Easy/Medium/Hard).
export const DIFFICULTY_FROM_LABEL: Record<string, string> = {
  Beginner: 'Easy', Intermediate: 'Medium', Advanced: 'Hard',
  Easy: 'Easy', Medium: 'Medium', Hard: 'Hard',
};

const text = (max: number) => z.string().trim().max(max);
const required = (label: string, max: number) => text(max).min(1, `${label} is required`);

const moduleFields = {
  title: required('Module title', 120),
  description: required('Short description', 500),
  category: required('Category', 60),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Easy', 'Medium', 'Hard']),
  learningObjectives: required('Learning objectives', 5000),
  content: text(200_000).optional().default(''),
  thumbnailUrl: z
    .string().trim().max(2000)
    .refine((u) => u === '' || /^https:\/\/\S+$/i.test(u), 'Thumbnail must be an https:// image URL')
    .optional(),
  estimatedTime: z.coerce.number().int().min(1).max(1000).optional(),
  tags: z.array(text(40).min(1)).max(20).optional(),
  referenceMaterials: text(5000).optional(),
};

const noQuery = { query: z.object({}).optional(), params: z.object({ id: z.string().min(1).optional() }).optional() };

export const createModuleSchema = z.object({
  body: z.object({ ...moduleFields, publish: z.boolean().optional() }),
  ...noQuery,
});

export const updateModuleSchema = z.object({
  body: z.object(moduleFields),
  ...noQuery,
});

export const archiveModuleSchema = z.object({
  body: z.object({ confirmName: z.string().min(1, 'Type the module name to confirm') }),
  ...noQuery,
});

export type ModuleInput = z.infer<typeof updateModuleSchema>['body'];

const idParams = { query: z.object({}).optional(), params: z.object({ id: z.string().min(1) }).optional() };

export const uploadUrlsSchema = z.object({
  body: z.object({
    files: z.array(z.object({ name: z.string().min(1).max(255), type: z.string().max(200), size: z.number().int().nonnegative() })).min(1).max(10),
  }),
  ...idParams,
});

export const uploadCompleteSchema = z.object({
  body: z.object({
    uploads: z.array(z.object({ uploadId: z.string().min(1).max(200), name: z.string().min(1).max(255), type: z.string().max(200) })).min(1).max(10),
  }),
  ...idParams,
});
