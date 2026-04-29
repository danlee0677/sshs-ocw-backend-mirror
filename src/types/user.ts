import { Types } from "mongoose";
import { z } from 'zod'

const accessTokenRecentViewedSchema = z.object({
  subjectId: z.coerce.string(),
  lessonId: z.coerce.string(),
  viewedAt: z.coerce.date(),
  image_url: z.string(),
  subject_title: z.string(),
  lesson_title: z.string(),
})

export type AccessTokenRecentViewed = z.infer<typeof accessTokenRecentViewedSchema>

export const accessTokenUserSchema = z.object({
  _id: z.string(),
  username: z.string(),
  pfp_url: z.string(),
  roles: z.array(z.string()),
  achievement: z.array(z.int()),
  liked_subject: z.array(z.string()),
  email: z.string(),
  description: z.string(),
})

export type AccessTokenUser = z.infer<typeof accessTokenUserSchema>

export interface ContextUser {
  _id: Types.ObjectId,
  username: string,
  pfp_url: string,
  roles: Array<string>,
  achievement: Array<Number>,
  liked_subject: Array<string>,
  email: string,
  description: string,
}