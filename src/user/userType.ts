import { z } from 'zod'

export const userCreateSchema = z.object({
  preference: z.array(z.string())
})