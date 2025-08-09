import { z } from 'zod';

export const moduleSchema = z.object({
  subject: z.string(),
  title: z.string(),
})

export type Module = z.infer<typeof moduleSchema>