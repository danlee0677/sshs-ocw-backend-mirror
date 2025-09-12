import mongoose, { Schema, Types } from 'mongoose'

const providerSchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true }, // mongodb _id
  
  provider: { type: String, enum: ['google', 'kakao', 'naver'], required: true },
  providerUserId: { type: String, required: true, default: "" } // google_id, kakao_id, naver_id, etc..
})

export const ProviderModel = mongoose.model('Provider', providerSchema);