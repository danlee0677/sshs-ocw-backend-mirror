import Router from "@koa/router";
import { Context, Next } from "koa";
import passport from 'koa-passport'
import { UserModel } from "./userModel";
import mongoose from "mongoose";

const userRouter = new Router()

userRouter.delete('/api/user/:userId',
  passport.authenticate('jwt', { session: false }),
  async function (ctx: Context, next: Next) {
    ctx.assert(ctx.isAuthenticated(), 401)
    ctx.assert(ctx.state.user, 401, "Not a user")

    const userId = ctx.params.userId;
    ctx.assert(mongoose.isValidObjectId(userId), 401);

    const user = await UserModel.findById(userId)
    ctx.assert(user, 401);
  })

export default userRouter