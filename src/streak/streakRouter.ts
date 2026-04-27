import Router from "@koa/router";
import { Context, Next } from "koa";
import passport from 'koa-passport'
import mongoose, { Types } from "mongoose";
import { streakModel } from "./streakModel";
import { computeStreaks, dayOfYear, isLeapYear, logicalDate } from './streakUtils';
import z from "zod";

const streakRouter = new Router()

streakRouter.get('/api/progress/:userId/streak',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { userId } = ctx.params;
    ctx.assert(mongoose.isValidObjectId(userId), 400, "Requested userId is not a valid object id");
    ctx.assert(ctx.state.user._id.toString() === userId, 403);

    const now = new Date()
    const logical = logicalDate(now)
    const thisYear = logical.getUTCFullYear()
    const prevYear = thisYear - 1
    const todayDoy = dayOfYear(logical)

    const [curDoc, prevDoc] = await Promise.all([
      streakModel.findOne({ userId: Types.ObjectId.createFromHexString(userId), year: thisYear }).lean(),
      streakModel.findOne({ userId: Types.ObjectId.createFromHexString(userId), year: prevYear }).lean(),
    ])

    const curEntries = Object.entries(curDoc?.days ?? {})
      .map(([d, c]) => ({ day: +d, count: c as number }))
      .sort((a, b) => a.day - b.day)
    const prevDays = Object.keys(prevDoc?.days ?? {}).map(Number).sort((a, b) => a - b)
    const curDays = curEntries.map((e) => e.day)

    const { currentStreak, longestStreak } = computeStreaks(curDays, prevDays, todayDoy, isLeapYear(prevYear))

    ctx.status = 200;
    ctx.body = {
      currentStreak,
      longestStreak,
      totalActiveDays: curDays.length,
      currentYearActivity: curEntries,
    }
  }
)

streakRouter.get('/api/progress/:userId/activity',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { userId } = ctx.params;
    ctx.assert(mongoose.isValidObjectId(userId), 400, "Requested userId is not a valid object id");
    ctx.assert(ctx.state.user._id.toString() === userId, 403);

    const parsed = z.coerce.number().int().min(2020).max(2100).safeParse(ctx.query.year);
    ctx.assert(parsed.success, 400, "year must be an integer between 2020 and 2100");

    const doc = await streakModel.findOne({
      userId: Types.ObjectId.createFromHexString(userId),
      year: parsed.data,
    }).lean()

    ctx.status = 200;
    ctx.body = {
      year: parsed.data,
      days: Object.entries(doc?.days ?? {})
        .map(([d, c]) => ({ day: +d, count: c as number }))
        .sort((a, b) => a.day - b.day),
    }
  }
)

export default streakRouter;