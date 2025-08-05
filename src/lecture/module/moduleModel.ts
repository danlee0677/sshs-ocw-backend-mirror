import mongoose, { Schema } from 'mongoose'

const moduleSchema = new Schema({
  subject: { type: Schema.Types.ObjectId, ref: 'subject', required: true },
  title: { type: String, required: true },
  order: { type: Number, required: true }
}, { timestamps: true })

export const ModuleModel = mongoose.model('module', moduleSchema);