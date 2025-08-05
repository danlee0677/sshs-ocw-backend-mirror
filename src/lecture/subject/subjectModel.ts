import mongoose, { Schema } from 'mongoose'

const subjectSchema = new Schema({
  title: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'user', required: true }
}, { timestamps: true })

export const SubjectModel = mongoose.model('subject', subjectSchema);