import mongoose, { Schema } from "mongoose";

export const userSchema = new Schema({
  username: { type: String, required: true, default: "", trim: true, maxlength: 20, unique: true },
  pfp_url: { type: String, required: true, default: "https://res.cloudinary.com/dxnbcmh48/image/upload/v1764310213/alfap9qgoadm1ytsyugm.png"},
  roles: { type: [String], required: true, default: [] },
  liked_subject: { type: [String], required: true, default: []},
  achievement: {type: [Number], required: true, default: []},
  email: { type: String, required: true, default: "" },
  description: { type: String, default: "" },
})

export const UserModel = mongoose.model('User', userSchema);

// mongoose swallows autoIndex failures. If existing data has duplicate usernames,
// the unique index is NOT created and uniqueness is silently unenforced - log it.
UserModel.on('index', (err) => {
  if (err) console.error('User index build failed (duplicate usernames in DB?):', err);
});