import { z } from 'zod';

export const lessonPostSchema = z.object({
  subject: z.string(),
  title: z.string(),
  content: z.string(),
  createdBy: z.string(),
  student_only: z.boolean(),
})

export type Lesson = z.infer<typeof lessonPostSchema>