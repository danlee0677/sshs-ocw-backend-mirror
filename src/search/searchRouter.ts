import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { Context, Next } from "koa";
import { SubjectModel } from "../lecture/subject/subjectModel";
import { z } from 'zod'
import { LessonModel } from "../lecture/lesson/lessonModel";
import { FilterQuery } from "mongoose";
import { canViewStudentOnly, optionalAuth } from "../lecture/lectureRouter";

const searchRouter = new Router();

searchRouter.post('/api/search', 
  optionalAuth, async function (ctx: Context, next: Next) {
  const parsed = z.object({
    subjectTitle: z.boolean(),
    subjectDescription: z.boolean(),
    lessonTitle: z.boolean(),
    tags: z.array(z.string()),
    or: z.boolean(),
    keyword: z.string().trim().max(20),
  }).safeParse(ctx.request.body);

  ctx.assert(parsed.success, 400);

  const keyword = parsed.data.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let filter_st: FilterQuery<typeof SubjectModel> = {
    title: { $regex: keyword, $options: 'i' },
  }

  let filter_sc: FilterQuery<typeof SubjectModel> = {
    description: { $regex: keyword, $options: 'i' },
  }

  let filter_lt: FilterQuery<typeof LessonModel> = {
    title: { $regex: keyword, $options: 'i' },
  }

  if (!canViewStudentOnly(ctx.state.user)) filter_lt["student_only"] = false;

  if (parsed.data.tags.length > 0) {
    if (parsed.data.or) {
      filter_st.tags = { $in: parsed.data.tags }
      filter_sc.tags = { $in: parsed.data.tags }
    } else {
      filter_st.tags = { $all: parsed.data.tags }
      filter_sc.tags = { $all: parsed.data.tags }
    }
  }

  const [st, sc, lt] = await Promise.all([
    parsed.data.subjectTitle ?
      SubjectModel.find(filter_st).select({ _id: 1, title: 1 })
      : Promise.resolve([]),

    parsed.data.subjectDescription ?
      SubjectModel.find(filter_sc).select({ _id: 1, description: 1 }).lean()
      : Promise.resolve([]),

    parsed.data.lessonTitle ?
      LessonModel.find(filter_lt).select({ _id: 1, subject: 1, title: 1 }).exec()
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