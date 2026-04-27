import Router from "@koa/router";
import { Context, Next } from "koa";
import passport from 'koa-passport'
import z from "zod";
import { MentoringModel } from "./mentoringModel";
import mongoose, { isValidObjectId } from "mongoose";
import { PermissionModel } from "../permission/permissionModel";
import { canEditSubject } from "../permission/permissionRouter";

const mentoringRouter = new Router();

const mentoringSchema = z.object({
  title: z.string(),
  image_url: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  content: z.string(),
  files: z.array(z.string()),
  createdBy: z.array(z.string()),
})

mentoringRouter.get('/api/mentoring/:mentoringId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { mentoringId } = ctx.params
    ctx.assert(isValidObjectId(mentoringId), 400, "Not a valid mentoringId");

    const mentoring = await MentoringModel.findById(mentoringId).lean();
    ctx.assert(mentoring, 404, "Cannot find corresponding mentoring object");

    ctx.status = 200;
    ctx.body = {
      _id: mentoring._id,
      title: mentoring.title,
      description: mentoring.description,
      content: mentoring.content,
      image_url: mentoring.image_url,
      files: mentoring.files,
      tags: mentoring.tags,
      createdBy: mentoring.createdBy,
    };
  }
)

mentoringRouter.post('/api/mentoring',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");
    const user = ctx.state.user;

    const isAdmin = ctx.state.user.roles.includes('admin');
    const isCreator = ctx.state.user.roles.includes('creator');
    ctx.assert(isAdmin || isCreator, 403, 'Not authorized to create new mentoring');

    const parsed = mentoringSchema.safeParse(ctx.request.body);
    ctx.assert(parsed.success, 400, "Failed to parse POST body");

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const [created] = await MentoringModel.create([{
          title: parsed.data.title,
          image_url: parsed.data.image_url,
          description: parsed.data.description,
          tags: parsed.data.tags,
          content: parsed.data.content,
          files: parsed.data.files,
          author: parsed.data.createdBy,
        }], { session });
        await PermissionModel.create([{
          userId: user._id,
          subjectId: created._id,
          role: 'owner',
        }], { session })
      })
    } finally {
      await session.endSession();
    }

    ctx.status = 201;
  }
)

mentoringRouter.patch('/api/mentoring/:mentoringId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)");

    const { mentoringId } = ctx.params;
    ctx.assert(isValidObjectId(mentoringId), 400, "Cannot find corresponding mentoring");

    const canEdit = await canEditSubject(ctx.state.user, mentoringId);
    ctx.assert(canEdit, 403, "No permission to edit mentoring");
    
    const parsed = mentoringSchema.safeParse(ctx.request.body);
    ctx.assert(parsed.success, 400, "Cannot parse request body");

    const updated = await MentoringModel.findByIdAndUpdate(
      mentoringId,
      { $set: {
        title: parsed.data.title,
        description: parsed.data.description,
        author: parsed.data.createdBy,
        image_url: parsed.data.image_url,
        content: parsed.data.content,
        files: parsed.data.files,
        tags: parsed.data.tags,
      } },
      { new: true }
    )

    ctx.assert(updated, 400, "Cannot update");

    ctx.status = 200;
  }
)

export default mentoringRouter;