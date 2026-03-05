import mongoose, { Schema, Types } from 'mongoose'

const PERMISSION_ROLES = ['owner', 'editor'] as const
export type PermissionRole = typeof PERMISSION_ROLES[number]

const permissionSchema = new Schema({
  userId:    { type: Types.ObjectId, ref: 'User',    required: true },
  subjectId: { type: Types.ObjectId, ref: 'Subject', required: true },
  role:      { type: String, enum: PERMISSION_ROLES, required: true },
}, { timestamps: true })

// One record per (user, subject) pair
permissionSchema.index({ userId: 1, subjectId: 1 }, { unique: true })

export const PermissionModel = mongoose.model('Permission', permissionSchema)
