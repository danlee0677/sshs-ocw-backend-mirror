import mongoose, { Schema } from "mongoose";
import { UserType } from "./userType";

export const userSchema = new Schema({
  google_id: { type: String, required: true },
  name: { type: String, required: true },
  roles: { type: [String], required: false, default: [] }
})

export const UserModel = mongoose.model<UserType>('user', userSchema);