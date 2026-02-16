import mongoose, { Schema } from 'mongoose';

export const lessonSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject:   { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  title:     { type: String, required: true },
  content:   { type: String, required: true },    // or store rich text, markdown, video URL, etc.
  order:     { type: Number, default: 0 },
  deleted: { type: Boolean, required: true, default: false },
  student_only: { type: Boolean, required: true, default: false},
}, { timestamps: true });

export const LessonModel = mongoose.model('Lesson', lessonSchema);