import mongoose, { Schema } from 'mongoose';

const lessonSchema = new Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true },
  module:   { type: Schema.Types.ObjectId, ref: 'module', required: true },
  title:     { type: String, required: true },
  content:   { type: String, required: true },    // or store rich text, markdown, video URL, etc.
  order:     { type: Number, default: 0 }
}, { timestamps: true });

export const LessonModel = mongoose.model('lesson', lessonSchema);