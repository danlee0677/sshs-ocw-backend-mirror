import mongoose, { Schema, Types } from 'mongoose'

const streakSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, required: true },
  days: { type: Map, of: Number, default: new Map() },
  // key: day-of-year string ("0"=Jan 1 … "364"=Dec 31), value: lesson view count
})

streakSchema.index({ userId: 1, year: 1 }, { unique: true })

export const StreakModel = mongoose.model('Streak', streakSchema)
