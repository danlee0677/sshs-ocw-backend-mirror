import Router from '@koa/router'
import { Context, Next } from 'koa';
import mongoose, { Mongoose, Types } from 'mongoose';
import passport from 'koa-passport'
import { ProgressModel } from './ProgressModel';
import { userCreateSchema } from '../user/userType';
import { SubjectModel } from '../lecture/subject/subjectModel';
import { LessonModel } from '../lecture/lesson/lessonModel';
import z from 'zod';

const progressRouter = new Router()

progressRouter.get('/api/progress/:subjectId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

    const subjectId = ctx.params.subjectId;

    ctx.assert(mongoose.isValidObjectId(subjectId), 400, "SubjectId is not a valid object id");

    const progresses = await ProgressModel.find({ userId: ctx.state.user._id, subjectId: subjectId })
  }
)

/* expect { status: "" } as a ctx.req.body*/
progressRouter.post('/api/progress/:subjectId/:lessonId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

    const parsed = z.object({
      status: z.enum(["not_started", "in_progress", "completed"])
    }).safeParse(ctx.body);

    ctx.assert(parsed.success, 400, "Request body is malformed")

    const subjectId = ctx.params.subjectId;
    const lessonId = ctx.params.lessonId;

    ctx.assert(mongoose.isValidObjectId(subjectId), 400, "subjectId param is not a valid object id");
    ctx.assert(mongoose.isValidObjectId(lessonId), 400, "lessonId param is not a valid object id");

    const subject = await SubjectModel.findById(subjectId);
    ctx.assert(subject, 404, "Corresponding subject not found");

    const lesson = await LessonModel.findById(lessonId);
    ctx.assert(lesson, 404, "Corresponding lesson not found");

    const progress = await ProgressModel.findOne({ userId: ctx.state.user._id, subjectId: subjectId, lessonId: lessonId });
    
    if (progress) {
      progress.status = parsed.data.status;
      progress.updatedAt = new Date();
      await progress.save();
    } else {
      const new_progress = await ProgressModel.create({
        userId: ctx.state.user._id,
        subjectId: subjectId,
        lessonId: lessonId,

        status: parsed.data.status,
        contentVersion: "0.0",
      })

      ctx.assert(new_progress, 400, "Failed to create new progress")
    }

    const update = await ProgressModel.updateOne({
      userId: ctx.state.user._id,
      subjectId: subjectId,
      lessonId: lessonId,
    }, {
      status: parsed.data.status,
      updatedAt: { $set: new Date() },
    }, { upsert: true }).exec();

    ctx.assert(update, 400, "failed to update");

    ctx.status = 201;
  }
)

export default progressRouter;