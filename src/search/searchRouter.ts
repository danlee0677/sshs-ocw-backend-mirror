import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { Context, Next } from "koa";
import { SubjectModel } from "../lecture/subject/subjectModel";
import { z } from 'zod'
import { LessonModel } from "../lecture/lesson/lessonModel";

const searchRouter = new Router();

searchRouter.post('/api/search', async function (ctx: Context, next: Next) {
  const parsed = z.object({
    subjectTitle: z.boolean(),
    subjectDescription: z.boolean(),
    lessonTitle: z.boolean(),
    keyword: z.string().trim().min(1).max(20),
  }).safeParse(ctx.request.body);

  ctx.assert(parsed.success, 400);

  const keyword = parsed.data.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const [st, sc, lt] = await Promise.all([
    parsed.data.subjectTitle ? 
      SubjectModel.find({
        title: { $regex: keyword, $options: 'i' }
      }).select({ _id: 1, title: 1 }).lean()
      : Promise.resolve([]),
    parsed.data.subjectDescription ?
      SubjectModel.find({
        description: { $regex: keyword, $options: 'i' }
      }).select({ _id: 1, description: 1 }).lean()
      : Promise.resolve([]),
    parsed.data.lessonTitle ? LessonModel.find({
        title: { $regex: keyword, $options: 'i' }
      }).select({ _id: 1, subject: 1, title: 1 }).exec()
      : Promise.resolve([])
  ])

  ctx.body = {
    subjectTitle: st,
    subjectDescription: sc,
    lessonTitle: lt,
  };
  ctx.status = 200;

  await next();
})

export default searchRouter;