import { Context, Next } from 'koa';
import Router from '@koa/router';
import { LessonModel } from './lesson/lessonModel';
import { SubjectModel } from './subject/subjectModel';
import { UserModel } from '../user/userModel';
import { ModuleModel } from './module/moduleModel';
import { subjectSchema } from './subject/subjectType';
import { moduleSchema } from './module/moduleType';
import { lessonSchema } from './lesson/lessonType';
import mongoose from 'mongoose';
import passport from 'koa-passport'

const lectureRouter = new Router();

// list all subjects
lectureRouter.get('/api/subjects', async (ctx: Context, next: Next) => {
  const subjects = await SubjectModel.find().exec();
  const filteredSubjects = subjects.map((subject) => {
    return { _id: subject._id, title: subject.title, createdAt: subject.createdAt }
  })
  ctx.body = filteredSubjects;
  ctx.status = 200;
  await next();
})

// create new subject
lectureRouter.post('/api/subjects', 
  passport.authenticate('jwt', { session: false }), 
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin', 403))

    const parsed = subjectSchema.safeParse(ctx.request.body);
    ctx.assert(parsed.success, 400);
    
    await SubjectModel.create({
      title: parsed.data.title,
    })

    ctx.status = 201;
    await next();
  })

// get one subject -> get all modules
lectureRouter.get('/api/subjects/:subjectId', async (ctx: Context, next: Next) => {
  const subjectId = ctx.params.subjectId;
  
  ctx.assert(mongoose.isValidObjectId(subjectId), 400);
  const subject = await SubjectModel.findById(subjectId);
  ctx.assert(subject, 404);

  const modules = await ModuleModel.find({ subject: subjectId })
                                   .sort({order: 1})
                                   .exec();
  const filteredModules = modules.map((module) => {
    return { _id: module._id, title: module.title };
  })

  ctx.body = {
    title: subject.title,
    _id: subject._id,
    contents: filteredModules,
  }
  
  ctx.status = 200;
  await next();
})

// delete subject
lectureRouter.delete('/api/subjects/:subjectId', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const subjectId = ctx.params.subjectId;
    // todo: auth

    ctx.assert(mongoose.isValidObjectId(subjectId), 400);
    
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const subject = await SubjectModel.findOne({ _id: subjectId }).session(session);

        ctx.assert(subject, 404);

        const modules = await ModuleModel.find({ subject: subject._id }).session(session);
        const moduleIds = modules.map((m) => (m._id));

        await LessonModel.deleteMany({ module: { $in: moduleIds } }).session(session);
        await ModuleModel.deleteMany({ subject: subject._id }).session(session);
        await SubjectModel.deleteOne({ _id: subject._id }).session(session);
      })

      ctx.status = 204;
    } finally {
      session.endSession();
    }
  })

// get one module -> get all lessons in module
lectureRouter.get('/api/modules/:moduleId', async (ctx: Context, next: Next) => {
  const moduleId = ctx.params.moduleId;
  ctx.assert(mongoose.isValidObjectId(moduleId), 400);

  const module = await ModuleModel.findOne({ _id: moduleId }).exec();
  ctx.assert(module, 404);

  const lessons = await LessonModel.find({ module: module._id }).exec();

  const filteredLessons = lessons.map((lesson) => {
    return { title: lesson.title, _id: lesson._id }
  })

  ctx.body = {subject: module.subject, iitle: module.title, _id: module._id, order: module.order, contents: filteredLessons};
  ctx.status = 200;
  
  await next();
})

// create a module
lectureRouter.post('/api/modules', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const parsed = moduleSchema.safeParse(ctx.request.body);
    
    ctx.assert(parsed.success, 400);

    ctx.assert(mongoose.isValidObjectId(parsed.data.subject), 400);

    const subject = await SubjectModel.findOne({ _id: parsed.data.subject }).exec();
    ctx.assert(subject, 404);

    const modules = await ModuleModel.find({subject: subject._id}).exec();

    await ModuleModel.create({
      subject: subject._id,
      title: parsed.data.title,
      order: modules.length,
    })

    ctx.status = 201;

    return await next()
  })

// delete a module
lectureRouter.delete('/api/modules/:moduleId', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const moduleId = ctx.params.moduleId;

    ctx.assert(mongoose.isValidObjectId(moduleId), 400);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const module = await ModuleModel.findOne({ _id: moduleId }).session(session);
        
        ctx.assert(module, 404);

        await LessonModel.deleteMany({ module: module._id }).session(session);
        await ModuleModel.deleteOne({ _id: module._id }).session(session);

        await ModuleModel.updateMany(
          { subject: module.subject, order: { $gt: module.order }},
          { $inc: { order: -1 } }
        ).session(session)
      })

      ctx.status = 204;
    } catch (err) {
      console.log(err);
      ctx.status = 404;
    }  finally {
      session.endSession();
    }
    await next()
  })

// get single lesson content
lectureRouter.get('/api/lessons/:lessonId', async (ctx: Context, next: Next) => {
  const lessonId = ctx.params.lessonId;
  ctx.assert(mongoose.isValidObjectId(lessonId), 400);

  const lesson = await LessonModel.findOne({ _id: ctx.params.lessonId })
                                  .populate('createdBy', ['_id', 'name']).exec();
  ctx.assert(lesson, 404);
  
  const filteredLesson = {
    title: lesson.title, 
    content: lesson.content, 
    createdBy: lesson.createdBy,
    module: lesson.module,
  }
  ctx.body = filteredLesson;
  ctx.status = 200;
  await next()
})

// delete lesson
lectureRouter.delete('/api/lessons/:lessonId',
  passport.authenticate("jwt", { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403);

    const id = ctx.params.lessonId;

    ctx.assert(mongoose.isValidObjectId(id), 400);
    
    const deleted = await LessonModel.findByIdAndDelete(id).exec();

    ctx.assert(deleted, 404);

    const session = await mongoose.startSession();
    try {
      await LessonModel.updateMany(
        { module: deleted.module, order: { $gt: deleted.order} },
        { $inc: { order: -1 }}
      ).session(session)
      ctx.status = 204;
    } catch (err) {
      console.log("delete lesson", err);
      ctx.status = 404;
    } finally {
      session.endSession()
    }
    
    await next()
  })

// create a lesson
lectureRouter.post('/api/lessons', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403);

    const parsed = lessonSchema.safeParse(ctx.request.body);

    ctx.assert(parsed.success, 400);
    ctx.assert(mongoose.isValidObjectId(parsed.data.createdBy), 400);
    ctx.assert(mongoose.isValidObjectId(parsed.data.module), 400);

    const user = await UserModel.findOne({ _id: parsed.data.createdBy }).exec();
    ctx.assert(user, 404);
    const module = await ModuleModel.findOne({ _id: parsed.data.module }).exec();
    ctx.assert(module, 404);
    // add order logic
    await LessonModel.create({
      title: parsed.data.title,
      createdBy: user._id,
      module: module._id,
      content: parsed.data.content,
    })

    ctx.status = 201;
  })

export default lectureRouter;