import mongoose, { Schema, Types } from 'mongoose'

const ProgressSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: Types.ObjectId, ref: 'Subject', required: true },
  lessonId: { type: Types.ObjectId, ref: 'Lesson', required: true },
  viewedAt: { type: Date, required: true }
})

export const ProgressModel = mongoose.model('lessonProgress', ProgressSchema);