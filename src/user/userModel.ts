import mongoose, { Schema } from "mongoose";
import { UserType } from "./userType";

export const userSchema = new Schema({
  name: { type: String, required: true, default: "" },
  google_id: { type: String, required: false, default: "" },
  kakao_id: { type: String, required: false, default: "" },
  naver_id: { type: String, required: false, default: "" },
  roles: { type: [String], required: false, default: [] }
})

export const UserModel = mongoose.model<UserType>('user', userSchema);