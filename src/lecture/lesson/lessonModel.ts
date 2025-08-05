import mongoose, { Schema } from 'mongoose';

export const lessonSchema = new Schema({
  module:   { type: Schema.Types.ObjectId, ref: 'module', required: true },
  title:     { type: String, required: true },
  content:   { type: String },    // or store rich text, markdown, video URL, etc.
  order:     { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('lesson', lessonSchema);