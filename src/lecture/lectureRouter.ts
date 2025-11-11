import { Context, Next } from 'koa';
import Router from '@koa/router';
import { LessonModel } from './lesson/lessonModel';
import { SubjectModel } from './subject/subjectModel';
import { UserModel } from '../user/userModel';
import { ModuleModel } from './module/moduleModel';
import { subjectSchema } from './subject/subjectType';
import { modulePatchSchema, modulePostSchema } from './module/moduleType';
import { lessonPostSchema } from './lesson/lessonType';
import mongoose, { Types } from 'mongoose';
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
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const parsed = subjectSchema.safeParse(ctx.request.body);
    ctx.assert(parsed.success, 400);
    
    const subject = await SubjectModel.create({
      title: parsed.data.title,
    })

    ctx.body = {
      _id: subject._id,
    }

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

  const lessons = await LessonModel.find({ module: module._id }).sort({order: 1}).exec();

  const filteredLessons = lessons.map((lesson) => {
    return { title: lesson.title, _id: lesson._id }
  })

  ctx.body = {subject: module.subject, title: module.title, _id: module._id, order: module.order, contents: filteredLessons};
  ctx.status = 200;
  
  await next();
})

// create a module
lectureRouter.post('/api/modules', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const parsed = modulePostSchema.safeParse(ctx.request.body);
    
    ctx.assert(parsed.success, 400);

    ctx.assert(mongoose.isValidObjectId(parsed.data.subject), 400);

    const subject = await SubjectModel.findOne({ _id: parsed.data.subject }).exec();
    ctx.assert(subject, 404);

    const modules = await ModuleModel.find({subject: subject._id}).exec();

    const new_module = await ModuleModel.create({
      subject: subject._id,
      title: parsed.data.title,
      order: modules.length,
    })

    ctx.body = {
      _id: new_module._id
    }

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

// patch a module and its lessons
lectureRouter.patch('/api/modules/:moduleId', 
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const moduleId = ctx.params.moduleId;

    ctx.assert(mongoose.isValidObjectId(moduleId), 400);

    const parsed = modulePatchSchema.safeParse(ctx.request.body);

    ctx.assert(parsed.success, 400);

    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const module = await ModuleModel.findById(moduleId).session(session);
        
        ctx.assert(module, 404);

        module.title = parsed.data.title;
        await module.save({ session, validateModifiedOnly: true });
        
        const newLessonIds = parsed.data.contents.map(x => x._id);

        const foundLessons = await LessonModel.find({
          _id: { $in: newLessonIds },
          module: module._id,
        }).select('_id').session(session);
        
        const foundSet = new Set(foundLessons.map(x => x._id.toString()));
        console.log(1)
        console.log(foundSet);
        ctx.assert(newLessonIds.filter((x) => !foundSet.has(x)).length === 0, 400);
        console.log(2);
        const attachedLessons = await LessonModel.find({ module: module._id }).select('_id').session(session);

        const toDelete = attachedLessons.map((x) => (x._id.toString())).filter((id) => !newLessonIds.includes(id));

        if (toDelete.length > 0) await LessonModel.deleteMany({ _id: { $in: toDelete }}).session(session);

        const operations = parsed.data.contents.map((item, ind) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(item._id) },
            update: { $set: { title: item.title, order: ind }},
          },
        }))

        if (operations.length > 0) await LessonModel.bulkWrite(operations, { session });
      })
      
      ctx.status = 200;
    } catch {
      ctx.status = 400;
    } finally {
      await session.endSession();
    }

    await next()
  })

// get single lesson content
lectureRouter.get('/api/lessons/:lessonId', async (ctx: Context, next: Next) => {
  const lessonId = ctx.params.lessonId;
  ctx.assert(mongoose.isValidObjectId(lessonId), 400);
  
  const lesson = await LessonModel.findOne({ _id: ctx.params.lessonId }).exec();
  //                                .populate("createdBy", ["_id", "name"])
  ctx.assert(lesson, 404);
  
  const filteredLesson = {
    title: lesson.title, 
    content: lesson.content, 
    createdBy: lesson.createdBy,
    module: lesson.module,
    _id: lesson._id,
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

    const parsed = lessonPostSchema.safeParse(ctx.request.body);

    ctx.assert(parsed.success, 400);
    ctx.assert(mongoose.isValidObjectId(parsed.data.createdBy), 400);
    ctx.assert(mongoose.isValidObjectId(parsed.data.module), 400);

    const user = await UserModel.findOne({ _id: parsed.data.createdBy }).exec();
    ctx.assert(user, 404);
    const module = await ModuleModel.findOne({ _id: parsed.data.module }).exec();
    ctx.assert(module, 404);
    const lessons = await LessonModel.find({ module: module._id }).exec();
    // add order logic

    await LessonModel.create({
      title: parsed.data.title,
      createdBy: user._id,
      module: module._id,
      content: parsed.data.content,
      order: lessons.length,
    })

    ctx.status = 201;
  })

export default lectureRouter;