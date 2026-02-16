import { z } from 'zod';

export const subjectSchema = z.object({
  title: z.string(),
  image_url: z.string(),
  description: z.string(),
  likes: z.number(),
  tags: z.array(z.string()),
})

export const subjectPatchSchema = z.object({
  title: z.string(),
  image_url: z.string(),
  description: z.string(),
  likes: z.number(),
  tags: z.array(z.string()),
  contents: z.array(z.object({
    _id: z.string(),
    title: z.string(),
  }))
})

export type Subject = z.infer<typeof subjectSchema>