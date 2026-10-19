import { z } from 'zod'

// Single source of truth for username rules. Every place that accepts a
// username (signup state, check-username, OAuth strategies, profile edit)
// must import this instead of using a bare z.string().
export const USERNAME_MIN = 2
export const USERNAME_MAX = 20
export const usernameSchema = z.string()
  .trim()
  .min(USERNAME_MIN, { message: "InvalidUsername" })
  .max(USERNAME_MAX, { message: "InvalidUsername" })
  .regex(/^[가-힣a-zA-Z0-9_]+$/, { message: "InvalidUsername" })

export const userCreateSchema = z.object({
  preference: z.array(z.string())
})