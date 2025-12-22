import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  name: { type: String, required: true, default: "" },
  pfp_url: { type: String, required: true, default: "https://res.cloudinary.com/dxnbcmh48/image/upload/v1764310213/alfap9qgoadm1ytsyugm.png"},
  roles: { type: [String], required: true, default: [] },
  preference: { type: [Boolean], required: true, default: [] }, // things like math, physics, 
  studyLevel: {type: [Boolean], required: true, default: [] }, // things like middle school, high school, etc
})

export const UserModel = mongoose.model('user', userSchema);