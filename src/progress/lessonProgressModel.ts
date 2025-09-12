import mongoose, { Schema, Types } from 'mongoose'

const lessonProgressSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: Types.ObjectId, ref: 'Subject', required: true },
  moduleId: { type: Types.ObjectId, ref: 'Module', required: true },
  lessonId: { type: Types.ObjectId, ref: 'Lesson', required: true },

  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started', required: true },
  contentVersion: { type: String, required: true, default: "" },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

export const LessonProgressModel = mongoose.model('lessonProgress', lessonProgressSchema);