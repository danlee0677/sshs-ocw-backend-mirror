import { z } from 'zod';

export const subjectSchema = z.object({
  title: z.string()
})

export const subjectPatchSchema = z.object({
  title: z.string(),
  contents: z.array(z.object({
    _id: z.string(),
    title: z.string(),
  }))
})

export type Subject = z.infer<typeof subjectSchema>