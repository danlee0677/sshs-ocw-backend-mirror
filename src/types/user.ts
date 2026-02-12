import { Types } from "mongoose";
import { z } from 'zod'

export const accessTokenUserSchema = z.object({
  _id: z.string(),
  username: z.string(),
  pfp_url: z.string(),
  roles: z.array(z.string()),
  liked_subject: z.array(z.string()),
  recent_viewed: z.array(z.object({
    subjectId: z.string(),
    lessonId: z.string(),
    viewedAt: z.date(),
    image_url: z.string(),
    subject_title: z.string(),
    lesson_title: z.string(),
  }))
})

export type AccessTokenUser = z.infer<typeof accessTokenUserSchema>

type RecentViewed = {
  subjectId: string,
  lessonId: string,
  viewedAt: Date,
  image_url: string, 
  subject_title: string,
  lesson_title: string,
}

export interface ContextUser {
  _id: Types.ObjectId,
  username: string,
  pfp_url: string,
  roles: Array<string>,
  liked_subject: Array<string>,
  recent_viewed: Array<RecentViewed>,
}