import { z } from 'zod'

const progressSchema = z.object({
  
})

export type ProgressType = z.infer<typeof progressSchema>