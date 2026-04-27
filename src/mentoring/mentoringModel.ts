import mongoose, { Schema } from 'mongoose'

const mentoringSchema = new Schema({
  title: { type: String, required: true },
  image_url: { type: String, required: true, default: "https://res.cloudinary.com/dpcig7o5t/image/upload/v1767019358/base_study_o0o20v.png" },
  description: { type: String, required: true },
  tags: { type: [String], required: true, default: [] },
  content: { type: String, required: true },
  files: { type: [String], required: true, default: [] },
  createdBy: { type: [String], required: true, default: [] },
}, { timestamps: true })

export const MentoringModel = mongoose.model('Mentoring', mentoringSchema)