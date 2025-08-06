import { Context, Next } from 'koa';
import Router from 'koa-router';
import { LessonModel } from './lesson/lessonModel';
import { SubjectModel } from './subject/subjectModel';
import { UserModel } from '../user/userModel';
import { ModuleModel } from './module/moduleModel';

const lectureRouter = new Router();

// list all subjects
lectureRouter.get('/api/subjects', async (ctx: Context, next: Next) => {
  const subjects = await SubjectModel.select({})
})

// create new subject
lectureRouter.post('/api/subjects', async (ctx: Context, next: Next) => {

})

// get one subject -> get all modules
lectureRouter.get('/api/subjects/:subjectId', async (ctx: Context, next: Next) => {

})

// delete subject
lectureRouter.delete('/api/subjects/:subjectId', async (ctx: Context, next: Next) => {

})

// get one module -> get all lessons in module
lectureRouter.get('/api/modules/:moduleId', async (ctx: Context, next: Next) => {

})

// create a module
lectureRouter.post('/api/modules', async (ctx: Context, next: Next) => {

})

// delete a module
lectureRouter.delete('/api/modules/:moduleId', async (ctx: Context, next: Next) => {

})

// get single lesson content
lectureRouter.get('/api/lessons/:lessonId', async (ctx: Context, next: Next) => {

})

// delete lesson
lectureRouter.delete('/api/lessons/:lessonId', async (ctx: Context, next: Next) => {

})

// create a lesson
lectureRouter.post('/api/lessons', async (ctx: Context, next: Next) => {

})

export default lectureRouter;