import Router from '@koa/router'
import { Context, Next } from 'koa';
import mongoose from 'mongoose';
import passport from 'koa-passport'
import { ProgressModel } from './ProgressModel';
import z from 'zod';

const progressRouter = new Router()

progressRouter.get('/api/progress',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

    const { subjectId, count } = ctx.query

    let filter: any = {
      userId: ctx.state.user._id,
    };

    if (subjectId) {
      ctx.assert(mongoose.isValidObjectId(subjectId), 400, "SubjectId is not a valid object id");
      filter.subjectId = subjectId
    }

    let query = ProgressModel.find(filter);
    
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