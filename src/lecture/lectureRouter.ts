import { Context, Next } from 'koa';
import Router from '@koa/router';
import { LessonModel, lessonSchema } from './lesson/lessonModel';
import { SubjectModel } from './subject/subjectModel';
import { UserModel } from '../user/userModel';
import { ModuleModel } from './module/moduleModel';
import { subjectPatchSchema, subjectSchema } from './subject/subjectType';
import { lessonPostSchema } from './lesson/lessonType';
import mongoose, { isValidObjectId, Types, HydratedDocumentFromSchema, FilterQuery } from 'mongoose';
import passport from 'koa-passport'
import { z } from 'zod';
import { ContextUser } from '../types/user';
import { ProgressModel } from '../progress/ProgressModel';
import { StreakModel } from '../streak/streakModel';
import { logicalDate, dayOfYear } from '../streak/streakUtils';
import { canEditSubject } from '../permission/permissionRouter';
import { PermissionModel } from '../permission/permissionModel';

const lectureRouter = new Router();

const isStudentRegex: RegExp = /@sshs\.hs\.kr$/;

export const canViewStudentOnly = async (user: ContextUser, subjectId: string | Types.ObjectId): Promise<boolean> => {
	if (user.roles.includes('admin') || isStudentRegex.test(user.email)) return true
	const perm = await PermissionModel.findOne({
		subjectId: subjectId,
		userId: user._id,
		role: { $in: ['owner', 'editor'] },
	}).lean()
	return !!perm
}

// list all subjects
lectureRouter.get('/api/subjects', async (ctx: Context, next: Next) => {
	const subjects = await SubjectModel.find().exec();
	const filteredSubjects = subjects.map((subject) => {
		return { _id: subject._id, title: subject.title, createdAt: subject.createdAt }
	})

	ctx.body = filteredSubjects;
	ctx.status = 200;
})

// get liked subjects by user
lectureRouter.get('/api/subjects/liked/:userId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

		const { userId: pageUserId } = ctx.params;

		ctx.assert(isValidObjectId(pageUserId), 400, "pageUser id is malformed");
		ctx.assert(isValidObjectId(ctx.state.user._id), 400, "User _id is malformed")

		const user = await UserModel.findById(pageUserId).exec();

		ctx.assert(user, 404, "Cannot find corresponding user")

		const subjects = await SubjectModel.find({ _id: { $in: user.liked_subject } }).lean().exec();

		const filteredSubjects = subjects.map((sub) => ({
			_id: sub._id,
			title: sub.title,
			description: sub.description,
			image_url: sub.image_url,
			tags: sub.tags,
		}));

		ctx.status = 200;
		ctx.body = filteredSubjects;
	})

// create new subject
lectureRouter.post('/api/subjects',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
		const canCreate = ctx.state.user.roles.includes('admin') || ctx.state.user.roles.includes('creator')
		ctx.assert(canCreate, 403)

		const parsed = subjectSchema.safeParse(ctx.request.body);

		ctx.assert(parsed.success, 400, "No Tags Selected");

		const subject = await SubjectModel.create({
			title: parsed.data.title,
			image_url: parsed.data.image_url,
			description: parsed.data.description,
			likes: 0,
			tags: parsed.data.tags,
			teacher_certified: false,
		})

		if (!ctx.state.user.roles.includes('admin')) {
			await PermissionModel.create({
				userId: ctx.state.user._id,
				subjectId: subject._id,
				role: 'owner',
			})
		}

		ctx.body = {
			_id: subject._id,
		}

		ctx.status = 201;
		await next();
	})

// get one subject -> get all lessons
lectureRouter.get('/api/subjects/:subjectId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");
		const subjectId = ctx.params.subjectId;

		ctx.assert(mongoose.isValidObjectId(subjectId), 400);
		const subject = await SubjectModel.findById(subjectId);
		ctx.assert(subject, 404);

		let filter: FilterQuery<typeof LessonModel> = {
			subject: subjectId,
		}

		if (!await canViewStudentOnly(ctx.state.user, subjectId)) filter["student_only"] = false

		const lessons = await LessonModel.find(filter)
			.sort({ order: 1 })
			.exec();
		const filteredLessons = lessons.map((lesson) => {
			return { _id: lesson._id, title: lesson.title };
		})

		ctx.body = {
			title: subject.title,
			image_url: subject.image_url,
			description: subject.description,
			likes: subject.likes,
			_id: subject._id,
			tags: subject.tags,
			teacher_certified: subject.teacher_certified,
			contents: filteredLessons,
		}

		ctx.status = 200;
		await next();
	})

// delete subject
lectureRouter.delete('/api/subjects/:subjectId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen
		const subjectId = ctx.params.subjectId;

		ctx.assert(mongoose.isValidObjectId(subjectId), 400);
		ctx.assert(await canEditSubject(ctx.state.user, subjectId), 403);

		const session = await mongoose.startSession();
		try {
			await session.withTransaction(async () => {
				const subject = await SubjectModel.findOne({ _id: subjectId }).session(session);

				ctx.assert(subject, 404);

				const modules = await ModuleModel.find({ subject: subject._id }).session(session);
				const moduleIds = modules.map((m) => (m._id));

				await LessonModel.deleteMany({ module: { $in: moduleIds } }).session(session);
				await ModuleModel.deleteMany({ subject: subject._id }).session(session);
				await PermissionModel.deleteMany({ subjectId: subject._id }).session(session);
				await SubjectModel.deleteOne({ _id: subject._id }).session(session);
			})

			ctx.status = 204;
		} finally {
			session.endSession();
		}
	})

// Edit subjects
lectureRouter.patch('/api/subjects/:subjectId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing User(RequireAuth not mounted?)");

		const subjectId = ctx.params.subjectId;
		ctx.assert(mongoose.isValidObjectId(subjectId), 400);
		ctx.assert(await canEditSubject(ctx.state.user, subjectId), 403);

		const parsed = subjectPatchSchema.safeParse(ctx.request.body);

		ctx.assert(parsed.success, 400);

		const session = await mongoose.startSession();

		try {
			await session.withTransaction(async () => {
				const subject = await SubjectModel.findById(subjectId).session(session);
				ctx.assert(subject, 404);

				subject.title = parsed.data.title;
				subject.image_url = parsed.data.image_url
				subject.description = parsed.data.description;
				subject.tags = parsed.data.tags;
				if (ctx.state.user && ctx.state.user.roles.includes('admin'))
					subject.teacher_certified = parsed.data.teacher_certified;
				await subject.save({ session, validateModifiedOnly: true });

				const newLessonIds = parsed.data.contents.map(x => x._id);

				const foundLessons = await LessonModel.find({
					_id: { $in: newLessonIds },
					subject: subject._id,
				}).select('_id').session(session);

				const foundSet = new Set(foundLessons.map(x => x._id.toString()));
				ctx.assert(newLessonIds.filter((x) => !foundSet.has(x)).length === 0, 400);
				const attachedLessons = await LessonModel.find({ subject: subject._id }).select('_id').session(session);

				const toDelete = attachedLessons.map((x) => (x._id.toString())).filter((id) => !newLessonIds.includes(id));

				if (toDelete.length > 0) await LessonModel.deleteMany({ _id: { $in: toDelete } }).session(session);

				const operations = parsed.data.contents.map((item, ind) => ({
					updateOne: {
						filter: { _id: new Types.ObjectId(item._id) },
						update: { $set: { title: item.title, order: ind } },
					},
				}))

				if (operations.length > 0) await LessonModel.bulkWrite(operations, { session });
			})

			ctx.status = 200;
		} catch (err) {
			ctx.status = 400;
		} finally {
			await session.endSession();
		}

		await next()
	}
)

// Subject Like
lectureRouter.post('/api/subjects/:subjectId/like',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing User(RequireAuth not mounted?)");

		const userId = ctx.state.user._id;
		const subjectId = ctx.params.subjectId;
		ctx.assert(mongoose.isValidObjectId(subjectId), 400);

		const session = await mongoose.startSession();

		try {
			let result: { liked: boolean, likes: number } | null = null;

			await session.withTransaction(async () => {
				const subject = await SubjectModel.findById(subjectId).session(session);
				ctx.assert(subject, 404);

				const addRes = await UserModel.updateOne(
					{ _id: userId, liked_subject: { $ne: subjectId } },
					{ $addToSet: { liked_subject: subjectId } }
				).session(session);


				if (addRes.modifiedCount === 1) {
					const updated = await SubjectModel.findByIdAndUpdate(
						subjectId,
						{ $inc: { likes: 1 } },
						{ new: true }
					).session(session);

					ctx.assert(updated, 404);

					result = { liked: true, likes: updated.likes };
					return;
				}

				const pullReq = await UserModel.updateOne(
					{ _id: userId, liked_subject: subjectId },
					{ $pull: { liked_subject: subjectId } }
				).session(session);

				if (pullReq.modifiedCount === 1) {
					const updated = await SubjectModel.findByIdAndUpdate(
						subjectId,
						{ $inc: { likes: -1 } },
						{ new: true }
					).session(session);

					ctx.assert(updated, 404);

					result = { liked: false, likes: updated.likes }
					return;
				}

				result = { liked: subject.likes > 0, likes: subject.likes }
			})
			ctx.status = 200;
			ctx.body = result
		} catch {
			ctx.status = 400;
		} finally {
			await session.endSession();
		}
	}
)

// update user history
const updateUserHistory = async (user: ContextUser, lesson: HydratedDocumentFromSchema<typeof lessonSchema>) => {
	const now = new Date()
	await ProgressModel.findOneAndUpdate(
		{ userId: user._id, subjectId: lesson.subject, lessonId: lesson._id },
		{ $set: { viewedAt: now } },
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	)
	// non-blocking: record the logical day's lesson count (KST 06:00 boundary)
	const logical = logicalDate(now)
	const doy = dayOfYear(logical)
	StreakModel.findOneAndUpdate(
		{ userId: user._id, year: logical.getUTCFullYear() },
		{ $inc: { [`days.${doy}`]: 1 } },
		{ upsert: true }
	).catch((err) => console.error('Err on updating UserActivity:', { userId: user._id, year: logical.getUTCFullYear(), doy, err }))
}

// get single lesson content
lectureRouter.get('/api/lessons/:lessonId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");
		const lessonId = ctx.params.lessonId;
		ctx.assert(mongoose.isValidObjectId(lessonId), 400);

		const lesson = await LessonModel.findOne({ _id: lessonId })
			.populate({ path: 'createdBy', select: 'username' });
		ctx.assert(lesson, 404);

		if (lesson.student_only && !await canViewStudentOnly(ctx.state.user, lesson.subject)) {
			ctx.throw(431, "Cannot view SSHS only material");
		}

		updateUserHistory(ctx.state.user, lesson).catch((err) => (console.error("Err on updating History: ", err)));

		const filteredLesson = {
			title: lesson.title,
			content: lesson.content,
			createdBy: lesson.createdBy,
			subject: lesson.subject,
			student_only: lesson.student_only,
			_id: lesson._id,
		}
		ctx.body = filteredLesson;
		ctx.status = 200;
	})

// delete lesson
lectureRouter.delete('/api/lessons/:lessonId',
	passport.authenticate("jwt", { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

		const lessonId = ctx.params.lessonId;
		ctx.assert(mongoose.isValidObjectId(lessonId), 400);

		const lesson = await LessonModel.findById(lessonId).lean().exec();
		ctx.assert(lesson, 404);
		ctx.assert(await canEditSubject(ctx.state.user, lesson.subject), 403);

		const deleted = await LessonModel.findByIdAndDelete(lessonId).exec();

		ctx.assert(deleted, 404);

		const session = await mongoose.startSession();
		try {
			await LessonModel.updateMany(
				{ subject: deleted.subject, order: { $gt: deleted.order } },
				{ $inc: { order: -1 } }
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

		const parsed = lessonPostSchema.safeParse(ctx.request.body);

		ctx.assert(parsed.success, 400);
		ctx.assert(mongoose.isValidObjectId(parsed.data.createdBy), 400);
		ctx.assert(mongoose.isValidObjectId(parsed.data.subject), 400);

		ctx.assert(await canEditSubject(ctx.state.user, parsed.data.subject), 403);

		const user = await UserModel.findOne({ _id: parsed.data.createdBy }).exec();
		ctx.assert(user, 404);
		const subject = await SubjectModel.findOne({ _id: parsed.data.subject }).exec();
		ctx.assert(subject, 404);
		const lessons = await LessonModel.find({ subject: subject._id }).exec();
		// add order logic

		await LessonModel.create({
			title: parsed.data.title,
			createdBy: user._id,
			subject: subject._id,
			content: parsed.data.content,
			order: lessons.length,
			student_only: parsed.data.student_only,
		})

		ctx.status = 201;
	})

// Edit lesson
lectureRouter.patch('/api/lessons/:lessonId',
	passport.authenticate('jwt', { session: false }),
	async (ctx: Context, next: Next) => {
		if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)"); // this should never happen

		const lessonId = ctx.params.lessonId;
		ctx.assert(mongoose.isValidObjectId(lessonId), 400)

		const tempSchema = z.object({
			title: z.string(),
			content: z.string(),
			student_only: z.boolean(),
		})

		const parsed = tempSchema.safeParse(ctx.request.body)
		ctx.assert(parsed.success, 400);

		const lessonForAuth = await LessonModel.findById(lessonId).lean().exec();
		ctx.assert(lessonForAuth, 404);
		ctx.assert(await canEditSubject(ctx.state.user, lessonForAuth.subject), 403);

		const session = await mongoose.startSession()
		try {
			await session.withTransaction(async () => {
				const lesson = await LessonModel.findById(lessonId).session(session);
				ctx.assert(lesson, 404);

				lesson.title = parsed.data.title;
				lesson.content = parsed.data.content;
				lesson.student_only = parsed.data.student_only;
				await lesson.save({ session, validateModifiedOnly: true });
			})
			ctx.status = 200
		} catch (err) {
			console.log("profile", err)
			throw err;
		} finally {
			session.endSession()
			await next();
		}
	}
)

export default lectureRouter;