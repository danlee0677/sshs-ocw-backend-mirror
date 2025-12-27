import { Types } from "mongoose";
import { z } from 'zod'

export const accessTokenUserSchema = z.object({
  _id: z.string(),
  username: z.string(),
  pfp_url: z.string(),
  roles: z.array(z.string()),
  liked_subject: z.array(z.string()),
})

export type AccessTokenUser = z.infer<typeof accessTokenUserSchema>

export interface ContextUser {
  _id: Types.ObjectId,
  username: string,
  pfp_url: string,
  roles: Array<string>,
  liked_subject: Array<string>,
}