import { Types } from "mongoose";
import { z } from 'zod'

export const accessTokenUserSchema = z.object({
  _id: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
  preference: z.array(z.boolean()), // things like math, physics, 
  studyLevel: z.array(z.boolean()), // things like middle school, high school, etc
})

export type AccessTokenUser = z.infer<typeof accessTokenUserSchema>

export interface ContextUser {
  _id: Types.ObjectId,
  name: string,
  roles: Array<string>,
  preference: Array<boolean>,
  studyLevel: Array<boolean>
}