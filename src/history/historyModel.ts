import mongoose, { Schema, Types } from 'mongoose'

const historySchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: Types.ObjectId, },
  image_url: {type: String, required: true, default: "https://res.cloudinary.com/dpcig7o5t/image/upload/v1767019358/base_study_o0o20v.png"},
  description: { type: String, required: true},
  likes: { type: Number, required: true},
}, { timestamps: true })

export const HistoryModel = mongoose.model('History', historySchema);