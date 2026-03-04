import Router from '@koa/router'
import { Context, Next } from 'koa';
import mongoose, { FilterQuery, Types } from 'mongoose';
import passport from 'koa-passport'
import { ProgressModel } from './ProgressModel';
import z from 'zod';

const progressRouter = new Router()

// need to be front, as @koa/router matches one up first
progressRouter.get('/api/progress/:userId/recent-subjects',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { userId } = ctx.params;
    ctx.assert(mongoose.isValidObjectId(userId), 400, "Requested userId is not a valid object id");

    ctx.assert(ctx.state.user._id.toString() === userId, 403);

    const results = await ProgressModel.aggregate([
      { $match: { userId: Types.ObjectId.createFromHexString(userId) } },
      { $sort: { viewedAt: -1 } },
      { $group: {
          _id: "$subjectId",
          lessonId: { $first: "$lessonId" },
          viewedAt: { $first: "$viewedAt" }
      }},
      { $sort: { viewedAt: -1 } },
      { $limit: 4 },
      { $lookup: {
          from: "subjects",
          localField: "_id",
          foreignField: "_id",
          as: "subject",
          pipeline: [{ $project: { _id: 1, title: 1, image_url: 1, description: 1 } }]
      }},
      { $lookup: {
          from: "lessons",
          localField: "lessonId",
          foreignField: "_id",
          as: "lesson",
          pipeline: [{ $project: { _id: 1, title: 1 } }]
      }},
      { $project: {
          _id: 0,
          subject: { $arrayElemAt: ["$subject", 0] },
          lesson:  { $arrayElemAt: ["$lesson",  0] },
          viewedAt: 1
      }}
    ]);

    ctx.status = 200;
    ctx.body = results;
  }
)

progressRouter.get('/api/progress/:userId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

    const { userId } = ctx.params
    const { subjectId, skip, count } = ctx.query

    ctx.assert(ctx.state.user._id.toString() === userId, 403);

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