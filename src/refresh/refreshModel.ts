import mongoose, { Schema } from "mongoose"

const refreshSchema = new Schema({
  jti: { type: String, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  usedAt: { type: Date, default: null },
  token: { type: String, required: true },
  expiresAt: { type: Date, expires: 0, required: true },
  createdAt: { type: Date, default: Date.now() },
  replacedBy: { type: String, default: null },
})

export const RefreshModel = mongoose.model('refresh', refreshSchema)