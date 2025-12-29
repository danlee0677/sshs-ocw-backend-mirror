import mongoose, { Schema } from 'mongoose'

const subjectSchema = new Schema({
  title: { type: String, required: true },
  image_url: {type: String, required: true, default: "https://res.cloudinary.com/dpcig7o5t/image/upload/v1767019358/base_study_o0o20v.png"},
  description: { type: String, required: true},
  likes: { type: Number, required: true},
}, { timestamps: true })

export const SubjectModel = mongoose.model('Subject', subjectSchema);