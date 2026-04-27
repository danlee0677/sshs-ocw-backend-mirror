import Router from '@koa/router'
import { Context, Next } from 'koa'
import passport from 'koa-passport'
import mongoose, { isValidObjectId, Types } from 'mongoose'
import { z } from 'zod'
import { PermissionModel } from './permissionModel'
import { SubjectModel } from '../lecture/subject/subjectModel'
import { UserModel } from '../user/userModel'
import { ContextUser } from '../types/user'

const permissionRouter = new Router()

export async function canEditSubject(
  user: ContextUser,
  subjectId: string | Types.ObjectId
): Promise<boolean> {
  if (user.roles.includes('admin')) return true
  const perm = await PermissionModel.findOne({
    userId: user._id,
    subjectId,
    role: { $in: ['owner', 'editor'] },
  }).lean()
  return !!perm
}

// Check if current user can edit a subject
permissionRouter.get('/api/permission/check/:subjectId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")

    const { subjectId } = ctx.params
    ctx.assert(mongoose.isValidObjectId(subjectId), 400, "subjectId is not a valid object id")

    let canEdit = false
    let role: string | null = null

    if (ctx.state.user.roles.includes('admin')) {
      canEdit = true
      role = 'admin'
    } else {
      const perm = await PermissionModel.findOne({ userId: ctx.state.user._id, subjectId }).lean()
      if (perm) {
        canEdit = true
        role = perm.role
      }
    }

    ctx.status = 200
    ctx.body = { canEdit, role }
    await next()
  }
)

// List all permissions for a subject (admin only)
permissionRouter.get('/api/permission/subject/:subjectId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")
    
    const { subjectId } = ctx.params
    ctx.assert(mongoose.isValidObjectId(subjectId), 400, "subjectId is not a valid object id")

    const isAdmin = ctx.state.user.roles.includes('admin')
    const isOwner = !isAdmin && await PermissionModel.findOne({ userId: ctx.state.user._id, subjectId, role: 'owner' }).lean()
    ctx.assert(isAdmin || isOwner, 403)

    const permissions = await PermissionModel.find({ subjectId })
      .populate({ path: 'userId', select: '_id username pfp_url' })
      .lean()

    ctx.status = 200

    type PopulatedPermission = {
      _id: Types.ObjectId
      userId: { _id: Types.ObjectId; username: string; pfp_url: string }
      subjectId: Types.ObjectId
      role: string
    }

    ctx.body = (permissions as unknown as PopulatedPermission[]).map((p) => ({
      _id: p._id,
      userId: p.userId._id,
      subjectId: p.subjectId,
      pfp_url: p.userId.pfp_url,
      username: p.userId.username,
      role: p.role,
    }))
    await next()
  }
)

// Grant permission (admin or subject owner)
const grantSchema = z.object({
  userId: z.string(),
  subjectId: z.string(),
  role: z.enum(['editor']),
})

permissionRouter.post('/api/permission',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")

    const parsed = grantSchema.safeParse(ctx.request.body)
    ctx.assert(parsed.success, 400, "Invalid request body")

    const { subjectId } = parsed.data
    ctx.assert(mongoose.isValidObjectId(subjectId), 400, "subjectId is not a valid object id")

    const isAdmin = ctx.state.user.roles.includes('admin')
    const isOwner = !isAdmin && await PermissionModel.findOne({ userId: ctx.state.user._id, subjectId, role: 'owner' }).lean()
    ctx.assert(isAdmin || isOwner, 403)

    const { userId, role } = parsed.data

    ctx.assert(mongoose.isValidObjectId(userId), 400, "userId is not a valid object id")

    const [user, subject, existing] = await Promise.all([
      UserModel.findById(userId).lean(),
      SubjectModel.findById(subjectId).lean(),
      PermissionModel.findOne({ userId, subjectId }).lean(),
    ])
    ctx.assert(user, 404, "User not found")
    ctx.assert(subject, 404, "Subject not found")
    ctx.assert(!existing || existing.role !== 'owner', 409, "Cannot demote an owner to editor")

    let permission
    try {
      permission = await PermissionModel.findOneAndUpdate(
        { userId, subjectId },
        { $set: { role } },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      )
    } catch (err: any) {
      // Concurrent upsert on the unique (userId, subjectId) index
      if (err?.code === 11000) {
        ctx.throw(409, 'Permission record already exists')
      }
      throw err
    }

    ctx.status = 201
    ctx.body = { _id: permission._id, userId, subjectId, role }
    await next()
  }
)

// Revoke permission (admin or subject owner)
permissionRouter.delete('/api/permission/:permissionId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")

    const { permissionId } = ctx.params
    ctx.assert(mongoose.isValidObjectId(permissionId), 400, "permissionId is not a valid object id")

    const target = await PermissionModel.findById(permissionId).lean()
    ctx.assert(target, 404, "Permission not found")
    ctx.assert(target.role === 'editor', 403, "Cannot remove an owner record via this endpoint")

    const isAdmin = ctx.state.user.roles.includes('admin')
    const isOwner = !isAdmin && await PermissionModel.findOne({ userId: ctx.state.user._id, subjectId: target.subjectId, role: 'owner' }).lean()
    ctx.assert(isAdmin || isOwner, 403)

    await PermissionModel.findByIdAndDelete(permissionId)

    ctx.status = 204
    await next()
  }
)

const permissionPatchSchema = z.object({
  to: z.string(),
})

permissionRouter.patch('/api/permission/:subjectId',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")
    const user = ctx.state.user

    const { subjectId } = ctx.params
    ctx.assert(isValidObjectId(subjectId), 400, "subjectId is not a valid object id")

    const parsed = permissionPatchSchema.safeParse(ctx.request.body)
    ctx.assert(parsed.success, 400, "Invalid request body")

    const { to } = parsed.data
    ctx.assert(isValidObjectId(to), 400, "to is not a valid object id")

    const isAdmin = user.roles.includes('admin')
    let previousOwnerId!: Types.ObjectId

    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        // Auth check and current-owner fetch are unified into one atomic read inside the transaction.
        // Non-admin path: querying by caller's userId ensures caller is still owner at transaction time,
        // preventing a concurrent transfer from slipping past the 403 gate.
        const currentOwnerPerm = !isAdmin
          ? await PermissionModel.findOne({ userId: user._id, subjectId, role: 'owner' }, null, { session }).lean()
          : await PermissionModel.findOne({ subjectId, role: 'owner' }, null, { session }).lean()

        if (!isAdmin) ctx.assert(currentOwnerPerm, 403)
        else ctx.assert(currentOwnerPerm, 404, "NoOwner")

        const targetPerm = await PermissionModel.findOne({ userId: to, subjectId }, null, { session }).lean()
        ctx.assert(targetPerm, 404, "NoPermissionRecord")

        ctx.assert(
          !(currentOwnerPerm!.userId as Types.ObjectId).equals(targetPerm.userId as Types.ObjectId),
          400,
          "AlreadyOwner"
        )

        await PermissionModel.updateOne({ _id: currentOwnerPerm!._id }, { $set: { role: 'editor' } }, { session })
        await PermissionModel.updateOne({ _id: targetPerm._id }, { $set: { role: 'owner' } }, { session })

        previousOwnerId = currentOwnerPerm!.userId as Types.ObjectId
      })
    } finally {
      await session.endSession()
    }

    ctx.status = 200
    ctx.body = {
      previousOwner: { userId: previousOwnerId, role: 'editor' },
      newOwner: { userId: to, role: 'owner' },
    }
    await next()
  }
)

// Grant or revoke global roles (admin only; only 'creator' is grantable)
const userRolesSchema = z.object({
  grant: z.array(z.enum(['creator'])).optional(),
  revoke: z.array(z.enum(['creator'])).optional(),
})

permissionRouter.patch('/api/user/:userId/roles',
  passport.authenticate('jwt', { session: false }),
  async (ctx: Context, next: Next) => {
    if (!ctx.state.user) throw new Error("assertUser: missing user (requireAuth not mounted?)")
    ctx.assert(ctx.state.user.roles.includes('admin'), 403)

    const { userId } = ctx.params
    ctx.assert(mongoose.isValidObjectId(userId), 400, "userId is not a valid object id")

    const parsed = userRolesSchema.safeParse(ctx.request.body)
    ctx.assert(parsed.success, 400, "Invalid request body")

    const { grant, revoke } = parsed.data
    ctx.assert((grant?.length ?? 0) + (revoke?.length ?? 0) > 0, 400, "Nothing to grant or revoke")

    const user = await UserModel.findById(userId)
    ctx.assert(user, 404, "User not found")

    if (grant?.length) await UserModel.updateOne({ _id: userId }, { $addToSet: { roles: { $each: grant } } })
    if (revoke?.length) await UserModel.updateOne({ _id: userId }, { $pull: { roles: { $in: revoke } } })

    const updated = await UserModel.findById(userId).select('roles').lean()
    ctx.status = 200
    ctx.body = { roles: updated?.roles }
    await next()
  }
)

export default permissionRouter;
