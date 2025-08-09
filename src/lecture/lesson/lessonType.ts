import { z } from 'zod';

export const lessonSchema = z.object({
  createdBy: z.string(),
  module: z.string(),
  title: z.string(),
  content: z.string(),
})

export type Lesson = z.infer<typeof lessonSchema>