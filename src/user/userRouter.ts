import Router from "@koa/router";
import { Context, Next } from "koa";
import passport from 'koa-passport'
import { UserModel, userSchema } from "./userModel";
import mongoose, { InferSchemaType } from "mongoose";
import z from "zod";
import { usernameSchema } from "./userType";

const userRouter = new Router()

userRouter.get('/api/user/:userId',
  passport.authenticate('jwt', { session: false }),
  async function (ctx: Context, next: Next) {
    const userId = ctx.params.userId;
    ctx.assert(mongoose.isValidObjectId(userId), 400);

    const user = await UserModel.findById(userId)
    ctx.assert(user, 404);

    if (ctx.state.user && ctx.state.user._id.toString() === userId) {
      ctx.body = {
        username: user.username,
        pfp_url: user.pfp_url,
        roles: user.roles,
        liked_subject: user.liked_subject,
        achievement: user.achievement,
        description: user.description,
      }
    }
    else {
      ctx.body = {
        username: user.username,
        pfp_url: user.pfp_url,
        achievement: user.achievement,
        description: user.description,
      }
    }

    await next();
  }
)

const userPatchSchema = z.object({
  username: usernameSchema.optional(),
  description: z.string()
    .max(100, { message: "DescriptionLengthLimit" })
    .refine(val => !/https?:\/\//i.test(val), { message: "DescriptionContainsUrl" })
    .optional(),
  pfp_url: z.string()
    .refine(val => { try { return new URL(val).protocol === "https:"; } catch { return false; } }, { message: "PfpUrlInvalid" })
    .optional(),
})

userRouter.patch('/api/user',
  passport.authenticate('jwt', { session: false }),
  async function (ctx: Context, next: Next) {
    if (!ctx.state.user) throw new Error("User not mounted: RequireAuth Error?");
    const parsed = userPatchSchema.safeParse(ctx.request.body);

    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = { errors: parsed.error.issues.map(i => i.message) };
      return;
    }
    const query: mongoose.UpdateQuery<InferSchemaType<typeof userSchema>> = {};
    
    if (parsed.data.username !== undefined) query["username"] = parsed.data.username;
    if (parsed.data.description !== undefined) query["description"] = parsed.data.description;
    if (parsed.data.pfp_url !== undefined) query["pfp_url"] = parsed.data.pfp_url

    let updated
    try {
      updated = await UserModel.findByIdAndUpdate(ctx.state.user._id, query, { new: true, runValidators: true });
    } catch (err: any) {
      // unique index on username: someone else already has it
      if (err?.code === 11000) {
        ctx.status = 409;
        ctx.body = { errors: ["DuplicateUsername"] };
        return;
      }
      throw err;
    }

    ctx.assert(updated, 404);
    ctx.status = 200;
    ctx.body = {
      username: updated.username,
      pfp_url: updated.pfp_url,
      description: updated.description,
    }
    await next();
  }
)

export default userRouter