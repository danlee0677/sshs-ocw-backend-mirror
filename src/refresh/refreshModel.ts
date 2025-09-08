import mongoose, { Schema } from "mongoose"

const refreshSchema = new Schema({
  jti: { type: String, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

export const RefreshModel = mongoose.model('refresh', refreshSchema)