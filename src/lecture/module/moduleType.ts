import { z } from 'zod';

export const moduleSchema = z.object({
  subject: z.string(),
  title: z.string(),
  order: z.number()
})

export type Module = z.infer<typeof moduleSchema>