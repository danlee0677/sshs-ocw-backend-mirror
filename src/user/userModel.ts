import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  username: { type: String, required: true, default: "" },
  pfp_url: { type: String, required: true, default: "https://res.cloudinary.com/dxnbcmh48/image/upload/v1764310213/alfap9qgoadm1ytsyugm.png"},
  roles: { type: [String], required: true, default: [] },
  liked_subject: { type: [String], required: true, default: []},
  email: { type: String, required: true, default: "" },
})

export const UserModel = mongoose.model('User', userSchema);