import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  name: { type: String, required: true, default: "" },
  roles: { type: [String], required: true, default: [] },
})

export const UserModel = mongoose.model('User', userSchema);