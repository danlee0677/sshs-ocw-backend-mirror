import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  name: { type: String, required: true, default: "" },
  roles: { type: [String], required: true, default: [] },
  preference: { type: [Boolean], required: true, default: [] }, // things like math, physics, 
  studyLevel: {type: [Boolean], required: true, default: [] }, // things like middle school, high school, etc
})

export const UserModel = mongoose.model('User', userSchema);