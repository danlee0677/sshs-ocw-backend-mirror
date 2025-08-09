import { z } from 'zod';

export const subjectSchema = z.object({
  title: z.string()
})

export type Subject = z.infer<typeof subjectSchema>