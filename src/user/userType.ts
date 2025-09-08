import { z } from 'zod'

const userSchema = z.object({
  google_id: z.string(),
  kakao_id: z.string(),
  naver_id: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
})

export type UserType = z.infer<typeof userSchema>