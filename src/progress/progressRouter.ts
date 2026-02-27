import Router from '@koa/router'
import { Context, Next } from 'koa';
import mongoose, { FilterQuery } from 'mongoose';
import passport from 'koa-passport'
import { ProgressModel } from './ProgressModel';
import z from 'zod';

const progressRouter = new Router()

progressRouter.get('/api/progress/:userId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

    const { userId } = ctx.params
    const { subjectId, skip, count } = ctx.query

    ctx.assert(mongoose.isValidObjectId(userId), 400, "Requested pageUserId is not a valid object id");
    let filter: FilterQuery<typeof ProgressModel> = {
      userId,
    };

    if (subjectId) {
      ctx.assert(mongoose.isValidObjectId(subjectId), 400, "SubjectId is not a valid object id");
      filter.subjectId = subjectId
    }

    let query = ProgressModel.find(filter).sort({ viewedAt: -1 });

    if (skip) {
      const parsed = z.coerce.number().safeParse(skip);
      ctx.assert(parsed.success, 400, "Start is not a valid number");
      query.skip(parsed.data);
    }

    if (count) {
      const parsed = z.coerce.number().safeParse(count);
      ctx.assert(parsed.success, 400, "Count is not a valid number");
      query.limit(parsed.data);
    }

    const progresses = await query.populate({
      path: 'lessonId',
      select: 'title'
    }).populate({
      path: 'subjectId',
      select: 'title image_url description'
    }).lean();

    const renamed = progresses.map((doc) => ({
      lesson: doc.lessonId,
      subject: doc.subjectId,
      userId: doc.userId,
      viewedAt: doc.viewedAt,
    }))

    ctx.status = 200;
    ctx.body = renamed;
  }
)

export default progressRouter;