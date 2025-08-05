import { z } from 'zod'

export const userSchema = z.object({
  google_id: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
})

export type UserType = z.infer<typeof userSchema>