import mongoose, { Schema } from 'mongoose'

const subjectSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true},
}, { timestamps: true })

export const SubjectModel = mongoose.model('Subject', subjectSchema);