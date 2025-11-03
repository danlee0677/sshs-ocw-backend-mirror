import { z } from 'zod';

export const modulePostSchema = z.object({
  subject: z.string(),
  title: z.string(),
})

export const modulePatchSchema = z.object({
  title: z.string(),
  contents: z.array(z.object({
    _id: z.string(),
    title: z.string(),
  }))
})