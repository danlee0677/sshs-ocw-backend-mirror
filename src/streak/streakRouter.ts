import Router from "@koa/router";
import { Context, Next } from "koa";
import passport from 'koa-passport'
import { FilterQuery, isValidObjectId } from "mongoose";
import { StreakModel } from "./streakModel";
import z from "zod";

const streakRouter = new Router()

streakRouter.get('/api/streak/:userId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { userId } = ctx.params;
    ctx.assert(isValidObjectId(userId), 400, "Requested userId is not a valid object id")

    const query = ctx.request.query;
    const queryParse = z.object({ year: z.coerce.number().optional() }).safeParse(query);

    ctx.assert(queryParse.success, 400, "Invalid query params");
    let dbQuery: FilterQuery<typeof StreakModel> = {
      userId: userId,
    }

    if (queryParse.data.year) dbQuery["year"] = queryParse.data.year;
    const streaks = await StreakModel.find(dbQuery).lean();
    
    const filteredStreaks = streaks.map((v) => ({
      _id: v._id,
      userId: v.userId,
      year: v.year,
      days: v.days,
    }))

    ctx.status = 200;
    ctx.body = filteredStreaks;
  }
)

export default streakRouter;